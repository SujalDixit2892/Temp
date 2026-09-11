const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = (
    globalThis.FACILITYOPS_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}/api${path}`, options);
    const payload = await response.json();

    if (!response.ok) {
        const message = payload?.detail || `API request failed (${response.status})`;
        throw new Error(message);
    }

    return payload;
}

export function getFacilities(limit) {
    const query = limit == null ? "" : `?limit=${encodeURIComponent(limit)}`;
    return request(`/facilities${query}`);
}

export function getEnergyAnalysis(facilityId, days) {
    const query = days == null ? "" : `?days=${encodeURIComponent(days)}`;
    return request(`/energy/${encodeURIComponent(facilityId)}/analyze${query}`);
}

export function getMaintenanceAssets(facilityId) {
    return request(`/maintenance/${encodeURIComponent(facilityId)}/assets`);
}

export function analyzeMaintenanceAsset(assetId) {
    return request(`/maintenance/asset/${encodeURIComponent(assetId)}/analyze`);
}

export function getOccupancyAnalysis(facilityId, days) {
    const query = days == null ? "" : `?days=${encodeURIComponent(days)}`;
    return request(`/occupancy/${encodeURIComponent(facilityId)}/analyze${query}`);
}

export const analyzeOccupancy = getOccupancyAnalysis;

export function analyzeSecurity(facilityId) {
    return getOccupancyAnalysis(facilityId);
}