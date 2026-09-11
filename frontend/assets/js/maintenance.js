import { loadFacilitySelector } from "./facilities.js";
import { analyzeMaintenanceAsset, getMaintenanceAssets } from "./api.js";

let assets = [];
let chart = null;

const $ = id => document.getElementById(id);

async function loadFacilities() {
    await loadFacilitySelector();
    await loadAssets();
}

async function loadAssets() {
    const facility = $("facility").value;

    if (!facility) {
        assets = [];
        renderFacility({}, true);
        return;
    }

    $("status").textContent = "LOADING";
    $("recommendation").textContent = "Loading maintenance analysis...";

    const result = await getMaintenanceAssets(facility);
    assets = Array.isArray(result.assets) ? result.assets : [];
    renderFacility(result, false);

    $("asset").innerHTML = assets.map((asset, index) => `
        <option value="${asset.asset_id ?? asset.id ?? index}">
            ${asset.asset_id ?? `Asset ${index + 1}`}
        </option>
    `).join("");

    renderAssets();
}

function renderFacility(result, loading) {
    const summary = result.summary || {};
    const successfulAssets = assets.filter(asset => asset.status === "success");
    const predictedFailures = successfulAssets.filter(asset => asset.high_risk === true).length;

    $("assetCount").textContent = summary.asset_count ?? assets.length ?? "--";
    $("healthScore").textContent = formatScore(summary.facility_health_score);
    $("highRisk").textContent = summary.high_risk_count ?? "--";
    $("predictedFailures").textContent = successfulAssets.length ? predictedFailures : "--";

    if (loading) {
        $("status").textContent = "WAITING";
        $("recommendation").textContent = "Select a facility to load maintenance analysis.";
    } else if (result.degraded) {
        $("status").textContent = "DEGRADED";
        $("recommendation").textContent =
            "Maintenance models are unavailable. Showing facility inventory only.";
    } else {
        $("status").textContent = "COMPLETE";
        $("recommendation").textContent =
            `${result.facility_id}: ${summary.asset_count ?? assets.length} assets assessed; ` +
            `${summary.high_risk_count ?? 0} high-risk assets require attention.`;
    }
}

function formatScore(value) {
    return value != null && Number.isFinite(Number(value))
        ? `${Number(value).toFixed(1)}`
        : "--";
}

function formatProbability(value) {
    return value != null && Number.isFinite(Number(value))
        ? `${(Number(value) * 100).toFixed(1)}%`
        : "--";
}

function renderAssets() {

    const container = $("assetList");

    if (!assets.length) {
        if (chart) {
            chart.destroy();
            chart = null;
        }
        container.innerHTML =
            `<div class="insight">No assets returned for this facility.</div>`;
        return;
    }

    container.innerHTML = assets.slice(0, 6).map(asset => `
        <div class="agent-row">
            <div class="agent-icon">M</div>
            <div class="agent-info">
                <strong>
                    ${asset.asset_id ?? "Asset"}
                </strong>
                <span>
                    ${asset.asset_type ?? "Monitored asset"} · ${asset.predicted_issue ?? "Analysis unavailable"}
                </span>
            </div>
            <span class="agent-state">
                ${asset.status === "success" ? `${formatScore(asset.health_score)}/100 · ${formatProbability(asset.failure_probability)}` : (asset.status ?? "UNAVAILABLE")}
            </span>
        </div>
    `).join("");

    renderChart();
}

function renderChart() {

    if (!window.Chart) return;

    const canvas = $("maintenanceChart");

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: assets.slice(0, 8).map(a => a.asset_id ?? "Asset"),
            datasets: [{
                label: "Asset Health Score",
                data: assets.slice(0, 8).map(a => Number.isFinite(Number(a.health_score)) ? Number(a.health_score) : null)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

async function testAsset() {

    const assetId = $("asset").value;

    if (!assetId) return;

    $("testStatus").textContent = "RUNNING";
    $("status").textContent = "ANALYZING";

    try {

        const result = await analyzeMaintenanceAsset(assetId);

        $("testStatus").textContent = result.degraded ? "DEGRADED" : "COMPLETE";
        $("status").textContent = result.degraded ? "DEGRADED" : "COMPLETE";

        $("testResult").textContent =
            JSON.stringify(result, null, 2);

        $("recommendation").textContent =
            result.degraded
                ? "Maintenance models are unavailable for this asset."
                : result.recommendation ??
                    result.analysis?.predicted_issue ??
                    "Analysis completed. Review the returned asset assessment.";

    } catch (error) {

        console.error(error);

        $("testStatus").textContent = "ERROR";
        $("status").textContent = "ERROR";

        $("testResult").textContent = error.message;
    }
}

$("facility").addEventListener("change", async () => {
    try {
        await loadAssets();
    } catch (error) {
        console.error(error);
        $("status").textContent = "ERROR";
        $("recommendation").textContent =
            `Unable to load maintenance data: ${error.message}`;
    }
});

$("runTest").addEventListener("click", testAsset);

loadFacilities().catch(error => {
    console.error(error);
    $("status").textContent = "ERROR";
    $("recommendation").textContent =
        `Unable to load maintenance data: ${error.message}`;
});