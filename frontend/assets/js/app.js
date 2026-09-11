import { loadFacilitySelector } from "./facilities.js";

const facilityDataset = {
    "HQ Tower": {
        kpis: {
            "1D": {
                health: 92,
                energyEfficiency: 87,
                assetHealth: 94,
                occupancy: 68,
                activeAlerts: 3
            },
            "7D": {
                health: 90,
                energyEfficiency: 85,
                assetHealth: 93,
                occupancy: 71,
                activeAlerts: 4
            },
            "30D": {
                health: 88,
                energyEfficiency: 83,
                assetHealth: 91,
                occupancy: 69,
                activeAlerts: 5
            }
        },

        energy: {
            "1D": [42, 38, 51, 67, 73, 61, 48],
            "7D": [46, 52, 49, 61, 68, 73, 65],
            "30D": [51, 48, 54, 59, 63, 67, 61]
        }
    },

    "Manufacturing Plant": {
        kpis: {
            "1D": {
                health: 84,
                energyEfficiency: 71,
                assetHealth: 79,
                occupancy: 82,
                activeAlerts: 7
            },
            "7D": {
                health: 81,
                energyEfficiency: 69,
                assetHealth: 77,
                occupancy: 79,
                activeAlerts: 9
            },
            "30D": {
                health: 78,
                energyEfficiency: 67,
                assetHealth: 74,
                occupancy: 76,
                activeAlerts: 12
            }
        },

        energy: {
            "1D": [78, 81, 76, 92, 108, 114, 101],
            "7D": [82, 88, 91, 97, 104, 111, 106],
            "30D": [76, 83, 89, 95, 102, 109, 113]
        }
    },

    "Tech Campus": {
        kpis: {
            "1D": {
                health: 96,
                energyEfficiency: 91,
                assetHealth: 97,
                occupancy: 54,
                activeAlerts: 1
            },
            "7D": {
                health: 95,
                energyEfficiency: 90,
                assetHealth: 96,
                occupancy: 57,
                activeAlerts: 2
            },
            "30D": {
                health: 94,
                energyEfficiency: 89,
                assetHealth: 95,
                occupancy: 55,
                activeAlerts: 2
            }
        },

        energy: {
            "1D": [31, 28, 35, 44, 49, 42, 36],
            "7D": [34, 37, 35, 41, 45, 47, 39],
            "30D": [36, 34, 38, 40, 43, 41, 39]
        }
    }
};

let selectedFacility = "HQ Tower";
let selectedDuration = "1D";
let energyChart = null;


function updateDashboard() {
    const facilityData = facilityDataset[selectedFacility];
    const kpiData = facilityData.kpis[selectedDuration];

    const facilityName = document.querySelector("[data-facility-name]");

    const values = {
        health: document.querySelector("[data-kpi='health']"),
        energyEfficiency: document.querySelector("[data-kpi='energy']"),
        assetHealth: document.querySelector("[data-kpi='asset']"),
        occupancy: document.querySelector("[data-kpi='occupancy']"),
        activeAlerts: document.querySelector("[data-kpi='alerts']")
    };

    if (facilityName) {
        facilityName.textContent = selectedFacility;
    }

    if (values.health) {
        values.health.textContent = `${kpiData.health}%`;
    }

    if (values.energyEfficiency) {
        values.energyEfficiency.textContent = `${kpiData.energyEfficiency}%`;
    }

    if (values.assetHealth) {
        values.assetHealth.textContent = `${kpiData.assetHealth}%`;
    }

    if (values.occupancy) {
        values.occupancy.textContent = `${kpiData.occupancy}%`;
    }

    if (values.activeAlerts) {
        values.activeAlerts.textContent = kpiData.activeAlerts;
    }

    updateEnergyChart();
}

loadFacilitySelector("facilitySelect").then(updateDashboard).catch(console.error);

function updateEnergyChart() {
    if (!energyChart) return;

    const facilityData = facilityDataset[selectedFacility];
    const values = facilityData.energy[selectedDuration];

    energyChart.data.datasets[0].data = values;

    const labels = {
        "1D": ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
        "7D": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "30D": ["Week 1", "Week 2", "Week 3", "Week 4", "Current"]
    };

    energyChart.data.labels = labels[selectedDuration];

    const energyAxis = document.getElementById("energyAxis");
    if (energyAxis) {
        energyAxis.replaceChildren(...labels[selectedDuration].map((label) => {
            const axisLabel = document.createElement("span");
            axisLabel.textContent = label;
            return axisLabel;
        }));
    }

    energyChart.update();
}


const energyCanvas = document.getElementById("energyChart");

if (energyCanvas && typeof Chart !== "undefined") {
    energyChart = new Chart(energyCanvas, {
        type: "line",
        data: {
            labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
            datasets: [{
                label: "Energy Consumption",
                data: facilityDataset[selectedFacility].energy[selectedDuration],
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            elements: {
                line: {
                    borderColor: "#8fc7d9",
                    borderWidth: 2,
                    tension: 0.35
                },
                point: {
                    radius: 3,
                    backgroundColor: "#dce4ec",
                    borderWidth: 0
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "kWh"
                    }
                }
            }
        }
    });

    updateEnergyChart();
}

function getNormalEnergy() {
    return facilityDataset[selectedFacility].energy[selectedDuration];
}

function getAnomalyEnergy() {
    const normal = getNormalEnergy();

    return normal.map((value, index) => {
        if (index >= normal.length - 2) {
            return Math.round(value * 1.7);
        }

        return value;
    });
}   

function setEnergyMode(mode, values) {
    if (!energyChart) return;

    energyChart.data.datasets[0].data = values;
    energyChart.update();

    document.querySelectorAll(".mode-btn").forEach((button) => {
        const isActive = button.id === `${mode}EnergyBtn`;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    const modeLabel = document.getElementById("energyMode");
    if (modeLabel) modeLabel.textContent = mode === "anomaly" ? "Anomaly injected" : "Normal baseline";
}

document.getElementById("normalEnergyBtn")?.addEventListener("click", () => {
    setEnergyMode("normal", getNormalEnergy());
});

document.getElementById("anomalyEnergyBtn")?.addEventListener("click", () => {
    setEnergyMode("anomaly", getAnomalyEnergy());
});


const facilitySelect = document.getElementById("facilitySelect");
const durationSelect = document.getElementById("durationSelect");

facilitySelect?.addEventListener("change", (event) => {
    const profileNames = Object.keys(facilityDataset);
    const selectedIndex = event.target.selectedIndex;
    selectedFacility = profileNames[selectedIndex] || profileNames[0];

    updateDashboard();
    setEnergyMode("normal", facilityDataset[selectedFacility].energy[selectedDuration]);
});

durationSelect?.addEventListener("change", (event) => {
    selectedDuration = event.target.value;

    updateDashboard();
    setEnergyMode("normal", facilityDataset[selectedFacility].energy[selectedDuration]);
});