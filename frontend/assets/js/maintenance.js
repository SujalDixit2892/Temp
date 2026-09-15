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

function escapeHtml(value) {
    return String(value ?? "--")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getHealthState(asset) {
    if (asset.status !== "success") return "unavailable";

    const probability = Number(asset.failure_probability);
    const score = Number(asset.health_score);
    if (!Number.isFinite(probability) && !Number.isFinite(score)) return "unavailable";
    if (asset.high_risk === true || probability >= 0.5 || score <= 50) return "critical";
    if (probability >= 0.15 || score < 85) return "warning";
    return "healthy";
}

function riskSortedAssets() {
    return assets
        .filter(asset => asset.status === "success" && Number.isFinite(Number(asset.failure_probability)))
        .sort((left, right) => Number(right.failure_probability) - Number(left.failure_probability));
}

function riskColor(probability) {
    const percent = Number(probability) * 100;
    if (percent >= 80) return "#bd5a5a";
    if (percent >= 60) return "#d6c15d";
    if (percent >= 40) return "#d68a5d";
    return "#65c99b";
}

function renderHealthDistribution() {
    const container = $("healthDistribution");
    const assessed = assets.filter(asset => getHealthState(asset) !== "unavailable");
    const counts = ["healthy", "warning", "critical"].map(state => ({
        state,
        count: assessed.filter(asset => getHealthState(asset) === state).length
    }));

    container.innerHTML = counts.map(({ state, count }) => `
        <div class="health-distribution-item ${state}">
            <div><span class="health-dot"></span><strong>${state}</strong></div>
            <span>${count} <small>${assessed.length ? `${((count / assessed.length) * 100).toFixed(0)}%` : "0%"}</small></span>
        </div>`).join("");
}

function renderAssetHealthMatrix() {
    const container = $("assetHealthMatrix");

    if (!assets.length) {
        container.innerHTML = `
            <tr>
                <td class="asset-matrix-empty" colspan="5">No assets returned for this facility.</td>
            </tr>`;
        return;
    }

    container.innerHTML = [...assets].sort((left, right) => {
        const risk = asset => Number.isFinite(Number(asset.failure_probability)) ? Number(asset.failure_probability) : -1;
        return risk(right) - risk(left);
    }).map(asset => {
        const state = getHealthState(asset);
        const status = asset.status === "success" ? state : asset.status ?? "unavailable";

        return `
            <tr class="asset-health-row ${state}">
                <td>
                    <strong>${escapeHtml(asset.asset_id ?? "Asset")}</strong>
                    <span class="asset-type">${escapeHtml(asset.asset_type ?? "Monitored asset")}</span>
                </td>
                <td class="health-value">${asset.status === "success" ? `${escapeHtml(formatScore(asset.health_score))}%` : "--"}</td>
                <td>${asset.status === "success" ? escapeHtml(formatProbability(asset.failure_probability)) : "--"}</td>
                <td><span class="health-status">${escapeHtml(status)}</span></td>
                <td>${escapeHtml(asset.predicted_issue ?? "Analysis unavailable")}</td>
            </tr>`;
    }).join("");
}

function renderAssets() {

    const container = $("assetList");
    renderHealthDistribution();
    renderAssetHealthMatrix();

    if (!assets.length) {
        if (chart) {
            chart.destroy();
            chart = null;
        }
        container.innerHTML =
            `<div class="insight">No assets returned for this facility.</div>`;
        return;
    }

    const priorityAssets = riskSortedAssets()
        .filter(asset => getHealthState(asset) !== "healthy")
        .slice(0, 3);
    container.innerHTML = priorityAssets.length ? priorityAssets.map(asset => `
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
    `).join("") : `<div class="insight">No assessed assets require attention.</div>`;

    renderChart();
}

function renderChart() {

    if (!window.Chart) return;

    const canvas = $("maintenanceChart");

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
        type: "bar",
        data: {
            indexAxis: "y",
            labels: riskSortedAssets().slice(0, 8).map(a => a.asset_id ?? "Asset"),
            datasets: [{
                label: "Failure Probability",
                data: riskSortedAssets().slice(0, 8).map(a => Number(a.failure_probability) * 100),
                backgroundColor: riskSortedAssets().slice(0, 8).map(a => riskColor(a.failure_probability)),
                borderRadius: 2,
                barThickness: 13
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { beginAtZero: true, max: 100 } },
            plugins: { legend: { display: false } }
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