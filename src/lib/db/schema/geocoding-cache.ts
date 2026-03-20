import {
  pgTable,
  text,
  real,
  uuid,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Geocoding cache table -- prevents redundant Google Maps API calls
 * by caching geocoding results keyed by a SHA-256 hash of the normalized address.
 *
 * - Null lat/lng entries cache "no result found" to avoid retrying known-bad addresses.
 * - Provider tracks which geocoder produced the result ("google" or "nominatim").
 * - Entries expire after 90 days (expiresAt set at insert time).
 */
export const geocodingCache = pgTable(
  "geocoding_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    addressHash: text("address_hash").notNull(),
    originalAddress: text("original_address").notNull(),
    lat: real("lat"),
    lng: real("lng"),
    formattedAddress: text("formatted_address"),
    provider: text("provider").notNull(), // "google" | "nominatim"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("geocoding_cache_hash_idx").on(table.addressHash),
  ]
);
