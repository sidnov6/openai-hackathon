import { load } from "cheerio";
import type { Listing, SearchRequest, SearchResult } from "@mainhaus/contracts";
import { SWFFM_APPLICATION_URL, SWFFM_DIRECTORY_URL, savedCatalog } from "./catalog.js";
import { straightLineDistance } from "./distance.js";

const RESIDENCE_PREFIX = "/wohnen/wohnheime/frankfurt-am-main/";

type DiscoveryOptions = {
  googleKey?: string | undefined;
  fetchImpl?: typeof fetch;
};

async function fetchWithTimeout(url: string, fetchImpl: typeof fetch, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller.signal,
      headers: { "user-agent": "MAINHAUS/0.1 educational housing research; contact via local operator", ...init.headers },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Source responded ${response.status}`);
    const final = new URL(response.url);
    if (final.protocol !== "https:" || final.hostname !== "www.swffm.de") throw new Error("Unexpected source redirect");
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function findPlace(address: string, origin: SearchRequest["origin"], key: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.location,places.formattedAddress",
    },
    body: JSON.stringify({
      textQuery: address,
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: origin.lat, longitude: origin.lng }, radius: 25_000 } },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { places?: Array<{ id?: string; location?: { latitude?: number; longitude?: number }; formattedAddress?: string }> };
  const place = payload.places?.[0];
  if (!place?.location || typeof place.location.latitude !== "number" || typeof place.location.longitude !== "number") return null;
  return {
    placeId: place.id,
    address: place.formattedAddress,
    coordinates: { lat: place.location.latitude, lng: place.location.longitude },
  };
}

async function mapLimited<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      result[index] = await mapper(items[index]!);
    }
  }));
  return result;
}

export async function discoverHousing(request: SearchRequest, options: DiscoveryOptions = {}): Promise<SearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const searchedAt = new Date().toISOString();
  let dataMode: SearchResult["dataMode"] = "live";
  const limitations: string[] = [];
  let listings: Listing[];

  try {
    const html = await (await fetchWithTimeout(SWFFM_DIRECTORY_URL, fetchImpl)).text();
    const $ = load(html);
    const links = new Map<string, string>();
    $(`a[href^="${RESIDENCE_PREFIX}"]`).each((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      const title = $(element).text().replace(/\s+/g, " ").trim();
      if (title && !links.has(href)) links.set(href, title);
    });
    if (links.size === 0) throw new Error("No Frankfurt residence links found in the official directory");
    listings = [...links].map(([href, title], index) => {
      const slug = href.slice(RESIDENCE_PREFIX.length).replace(/\/$/, "");
      const canonicalUrl = new URL(href, SWFFM_DIRECTORY_URL).toString();
      const address = /\d/.test(title) ? `${title}, Frankfurt am Main` : undefined;
      return {
        id: `swffm:${slug}`,
        provider: { id: "swffm", name: "Studierendenwerk Frankfurt am Main", role: "housing_provider" as const },
        externalId: slug,
        canonicalUrl,
        title,
        scope: "residence" as const,
        ...(address ? { address } : {}),
        locationPrecision: "unknown" as const,
        availability: "unknown" as const,
        monthlyCost: { amountCents: null, basis: "unknown" as const, label: "Current total not verified", unknownComponents: ["Kaltmiete", "Nebenkosten", "utilities"] },
        contact: { role: "application_office" as const, label: "Official application route", url: SWFFM_APPLICATION_URL },
        sourceRefs: [{ id: `swffm-${slug}`, kind: "webpage" as const, url: canonicalUrl, retrievedAt: searchedAt }],
        checkedAt: searchedAt,
        ...(index < 20 ? { demoPolicySlotId: `ffm-demo-${String(index + 1).padStart(3, "0")}` } : {}),
      } satisfies Listing;
    });
  } catch {
    dataMode = "saved_discovery";
    listings = savedCatalog();
    limitations.push("The official residence directory could not be refreshed. These records are saved discovery with their original timestamps, not live availability.");
  }

  if (options.googleKey) {
    listings = await mapLimited(listings, 3, async (listing) => {
      if (!listing.address) return listing;
      try {
        const place = await findPlace(listing.address, request.origin, options.googleKey!, fetchImpl);
        if (!place) return listing;
        return {
          ...listing,
          ...(place.placeId ? { externalId: place.placeId } : {}),
          ...(place.address ? { address: place.address } : {}),
          coordinates: place.coordinates,
          locationPrecision: "exact",
          distanceMeters: straightLineDistance(request.origin, place.coordinates),
        };
      } catch {
        return listing;
      }
    });
  } else {
    limitations.push("A Google Maps server key is not configured, so residence coordinates and radius distances are not asserted by the API.");
  }

  const filtered = listings.filter((listing) => {
    if (typeof listing.distanceMeters === "number" && listing.distanceMeters > request.radiusKm * 1000) return false;
    if (request.maxMonthlyCostCents !== undefined) {
      const amount = listing.monthlyCost?.amountCents;
      if (amount === null || amount === undefined) return request.includeUnknownPrices;
      if (amount > request.maxMonthlyCostCents) return false;
    }
    return true;
  }).sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER));

  return {
    dataMode,
    dataModeLabel: dataMode === "live" ? "Live official-directory discovery" : "Saved discovery",
    listings: filtered,
    counts: {
      residencesFound: filtered.filter((listing) => listing.scope === "residence").length,
      sourceReportedOffers: filtered.filter((listing) => listing.availability === "offer_reported").length,
      applicationsOpen: filtered.filter((listing) => listing.availability === "applications_open").length,
      availabilityUnknown: filtered.filter((listing) => listing.availability === "unknown").length,
    },
    searchedAt,
    limitations,
  };
}

