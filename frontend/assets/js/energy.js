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

function renderChart(anomalies) {
    const canvas = document.getElementById("energyChart");
    if (!canvas || typeof Chart === "undefined") return;

    if (energyChart) energyChart.destroy();

    energyChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: anomalies.map(x => x.date),
            datasets: [
                {
                    label: "Actual",
                    data: anomalies.map(x => x.actual_kwh),
                    tension: 0.3
                },
                {
                    label: "Model Prediction",
                    data: anomalies.map(x => x.predicted_kwh),
                    tension: 0.3
                }
            ]
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

function clearEnergyResults() {
    ["forecast", "anomalyCount", "wastageDays", "modelMae", "forecastDetail", "sourceDetail", "reasonerSource"]
        .forEach(id => setText(id, "--"));

    if (energyChart) {
        energyChart.destroy();
        energyChart = null;
    }

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
    renderChart(anomalies);
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