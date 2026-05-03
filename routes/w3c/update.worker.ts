import w3cGroupsScraper from "../../scripts/update-w3c-groups-list.js";

export default async function w3cGroupsUpdate() {
  try {
    await w3cGroupsScraper();
    return { updated: true };
  } catch (error) {
    console.error("W3C groups update failed:", error);
    return { updated: false };
  }
}
