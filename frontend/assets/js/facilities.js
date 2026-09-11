import { getFacilities } from "./api.js";

export async function loadFacilitySelector(selectorId = "facility") {
    const selector = document.getElementById(selectorId);
    if (!selector) return [];

    const facilities = await getFacilities();
    selector.replaceChildren(...facilities.map((facility) => {
        const facilityId = facility.facility_id;
        const facilityName =
            facility.name ||
            facility.facility_name ||
            facility.display_name ||
            facility.facility_type ||
            facilityId;
        const option = new Option(
            facilityName === facilityId
                ? facilityId
                : `${facilityName} (${facilityId})`,
            facilityId
        );
        return option;
    }));

    return facilities;
}