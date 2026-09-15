import { getEnergyAnalysis } from "./api.js";
import { loadFacilitySelector } from "./facilities.js";

let energyChart = null;

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "--";
}

function renderAnomalies(anomalies) {
    const container = document.getElementById("anomalies");

    if (!container) return;

    if (!anomalies.length) {
        container.innerHTML =
            `<div class="anomaly">No significant energy wastage detected.</div>`;
        return;
    }

    container.innerHTML = anomalies.map(item => `
        <div class="anomaly">
            <strong>${item.date}</strong>
            <span>
                Actual ${item.actual_kwh} kWh
                · Model ${item.predicted_kwh} kWh
                · Excess ${item.excess_pct}%
            </span>
        </div>
    `).join("");
}

function renderChart(analysis, anomalies) {
    const canvas = document.getElementById("energyChart");
    if (!canvas || typeof Chart === "undefined") return;

    const container = canvas.parentElement;
    container.querySelector(".chart-empty")?.remove();
    canvas.style.display = "block";

    if (energyChart) energyChart.destroy();

    const points = getEnergyPoints(analysis, anomalies);
    const labels = points.map(point => point.date);
    const actual = points.map(point => point.actual);
    const expected = points.map(point => point.expected);
    const hasActual = actual.some(value => value != null);
    const hasExpected = expected.some(value => value != null);

    if (!labels.length || (!hasActual && !hasExpected)) {
        canvas.style.display = "none";
        container.appendChild(createChartMessage("No energy consumption series returned."));
        return;
    }

    const datasets = [];
    if (hasActual) {
        datasets.push({
            label: "Actual consumption",
            data: actual,
            borderColor: "#5bd19a",
            backgroundColor: "rgba(91, 209, 154, 0.12)",
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.3,
            spanGaps: true
        });
    }
    if (hasExpected) {
        datasets.push({
            label: "Expected / baseline",
            data: expected,
            borderColor: "#8f9dad",
            borderDash: [6, 4],
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3,
            spanGaps: true
        });
    }

    const anomalyValues = points.map(point => point.isAnomaly ? point.actual : null);
    if (hasActual && anomalyValues.some(value => value != null)) {
        datasets.push({
            label: "Detected anomaly",
            data: anomalyValues,
            showLine: false,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: "#e17b68",
            pointBorderColor: "#f8c0a8",
            pointBorderWidth: 2,
            tooltip: { callbacks: { label: context => `Anomaly: ${context.parsed.y} kWh` } }
        });
    }

    energyChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    position: "bottom"
                }
            }
        }
    });
}

function getEnergyPoints(analysis, anomalies) {
    const series = [
        analysis?.history,
        analysis?.energy_history,
        analysis?.series,
        analysis?.data
    ].find(value => Array.isArray(value));
    const source = series?.length ? series : anomalies;
    const anomalyDates = new Set(anomalies.map(item => dateKey(item.date)));

    return source.map(item => ({
        date: item.date ?? item.timestamp ?? item.day,
        actual: toNumber(item.actual_kwh ?? item.electricity_kwh ?? item.consumption_kwh),
        expected: toNumber(item.expected_kwh ?? item.baseline_kwh ?? item.predicted_kwh),
        isAnomaly: Boolean(item.is_anomaly ?? item.anomaly) || anomalyDates.has(dateKey(item.date ?? item.timestamp ?? item.day))
    })).filter(point => point.date != null);
}

function dateKey(value) {
    return String(value ?? "").slice(0, 10);
}

function toNumber(value) {
    const number = Number(value);
    return value == null || !Number.isFinite(number) ? null : number;
}

function createChartMessage(message) {
    const element = document.createElement("div");
    element.className = "chart-empty";
    element.textContent = message;
    return element;
}

function clearEnergyResults() {
    ["forecast", "anomalyCount", "wastageDays", "modelMae", "forecastDetail", "sourceDetail", "reasonerSource"]
        .forEach(id => setText(id, "--"));

    if (energyChart) {
        energyChart.destroy();
        energyChart = null;
    }

    const canvas = document.getElementById("energyChart");
    canvas?.parentElement.querySelector(".chart-empty")?.remove();
    if (canvas) canvas.style.display = "block";

    const anomalies = document.getElementById("anomalies");
    if (anomalies) {
        anomalies.textContent = "No energy analysis is available.";
    }
}

function renderEnergy(result) {
    const analysis = result?.analysis;

    if (result?.degraded || !analysis) {
        clearEnergyResults();
        setText("status", "DEGRADED");
        setText(
            "recommendation",
            result?.degradation_reason || "Energy analysis is unavailable for this facility."
        );
        setText("reasonerSource", "UNAVAILABLE");
        return;
    }

    const recommendation = result.recommendation;
    const anomalies = Array.isArray(analysis.anomalies) ? analysis.anomalies : [];

    setText("status", analysis.status === "success" ? "ANALYSIS COMPLETE" : "DEGRADED");

    setText(
        "forecast",
        analysis.forecast_next_day_kwh != null
            ? `${analysis.forecast_next_day_kwh.toLocaleString()} kWh`
            : "--"
    );

    setText(
        "anomalyCount",
        anomalies.length
    );

    setText(
        "wastageDays",
        analysis.wastage_days_count ?? 0
    );

    setText(
        "modelMae",
        analysis.model_mae ?? result.provenance?.model_mae ?? "--"
    );

    setText(
        "forecastDetail",
        analysis.forecast_next_day_kwh != null
            ? `${analysis.forecast_next_day_kwh} kWh · ${analysis.forecast_next_day}`
            : "--"
    );

    setText("sourceDetail", recommendation?.source ?? result.provenance?.source ?? "--");
    setText("reasonerSource", recommendation?.source ?? "WAITING");

    setText(
        "recommendation",
        recommendation?.text ?? "No recommendation generated."
    );

    renderAnomalies(anomalies);
    renderChart(analysis, anomalies);
}

async function runEnergy() {
    const facility = document.getElementById("facility")?.value;
    const duration = document.getElementById("duration")?.value;

    if (!facility) return;

    setText("status", "RUNNING");
    setText("reasonerSource", "RUNNING");
    setText(
        "recommendation",
        "Energy Agent is analyzing facility telemetry..."
    );

    try {
        const result = await getEnergyAnalysis(
            facility,
            duration === "all" ? undefined : Number(duration)
        );
        renderEnergy(result);
    } catch (error) {
        console.error(error);
        clearEnergyResults();
        setText("status", "ERROR");
        setText("reasonerSource", "ERROR");
        setText("recommendation", error.message);
    }
}

async function initEnergy() {
    try {
        const facilities = await loadFacilitySelector();
        const select = document.getElementById("facility");

        select.addEventListener("change", runEnergy);
        document.getElementById("duration").addEventListener("change", runEnergy);

        document
            .getElementById("runAnalysis")
            .addEventListener("click", runEnergy);

        if (facilities.length) {
            await runEnergy();
        }

    } catch (error) {
        console.error(error);
        setText("status", "BACKEND ERROR");
        setText("recommendation", error.message);
    }
}

initEnergy();