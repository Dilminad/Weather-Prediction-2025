// Global variables
let predictionHistory = [];
let featureChart = null;
let trendChart = null;
let correlationChart = null;
let currentLocation = 'new_york';

// API Base URL
const API_BASE_URL = window.location.origin;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Temperature Prediction System Initializing...');
    
    // Initialize charts
    initializeCharts();
    
    // Load prediction history
    loadPredictionHistory();
    
    // Check API health
    checkApiHealth();
    
    // Load available locations
    loadLocations();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    // Show/hide custom coordinates
    document.getElementById('location').addEventListener('change', function() {
        const customCoords = document.getElementById('custom-coords');
        customCoords.style.display = this.value === 'custom' ? 'block' : 'none';
        
        if (this.value !== 'custom') {
            currentLocation = this.value;
        }
    });
});

// Initialize charts
function initializeCharts() {
    // Feature importance chart
    const featureCtx = document.getElementById('featureChart').getContext('2d');
    featureChart = new Chart(featureCtx, {
        type: 'bar',
        data: {
            labels: ['Humidity', 'Pressure', 'Wind Speed', 'Previous Temp', 'Cloud Cover', 'Precipitation', 'Latitude', 'Longitude', 'Month', 'Day of Week', 'Elevation'],
            datasets: [{
                label: 'Feature Importance',
                data: [0.15, 0.12, 0.10, 0.18, 0.08, 0.05, 0.09, 0.08, 0.07, 0.04, 0.04],
                backgroundColor: [
                    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', 
                    '#EF476F', '#073B4C', '#118AB2', '#06D6A0', '#FFD166', '#EF476F'
                ],
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${(context.raw * 100).toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Importance Score'
                    },
                    ticks: {
                        callback: function(value) {
                            return (value * 100).toFixed(0) + '%';
                        }
                    }
                },
                x: {
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });

    // Trend chart
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
            datasets: [
                {
                    label: 'Predicted Min Temp (°F)',
                    data: [65, 62, 60, 58, 59, 61, 63],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Historical Avg (°F)',
                    data: [67, 64, 62, 61, 62, 63, 65],
                    borderColor: '#FF6B6B',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°F)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Forecast Days'
                    }
                }
            }
        }
    });

    // Correlation chart
    const correlationCtx = document.getElementById('correlationChart').getContext('2d');
    correlationChart = new Chart(correlationCtx, {
        type: 'radar',
        data: {
            labels: ['Humidity', 'Pressure', 'Wind Speed', 'Cloud Cover', 'Precipitation', 'Previous Temp'],
            datasets: [{
                label: 'Current Input Impact',
                data: [0.8, 0.6, 0.7, 0.4, 0.3, 0.9],
                backgroundColor: 'rgba(102, 126, 234, 0.2)',
                borderColor: '#667eea',
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#667eea'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 1
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                }
            }
        }
    });
}

// Check API health
async function checkApiHealth() {
    try {
        showLoading('Checking API status...');
        const response = await axios.get(`${API_BASE_URL}/api/health`);
        
        if (response.data.status === 'healthy') {
            document.getElementById('api-status').textContent = 'API is healthy ✓';
            document.getElementById('api-status').style.color = '#28a745';
            console.log('API Health Check: PASSED');
        } else {
            document.getElementById('api-status').textContent = 'API issues detected';
            document.getElementById('api-status').style.color = '#ffc107';
        }
        hideLoading();
    } catch (error) {
        console.error('API Health Check Failed:', error);
        document.getElementById('api-status').textContent = 'API connection failed';
        document.getElementById('api-status').style.color = '#dc3545';
        hideLoading();
    }
}

// Load locations
async function loadLocations() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/weather/locations`);
        if (response.data.success && response.data.locations) {
            // Locations are already hardcoded in HTML, but we could update them dynamically here
            console.log('Locations loaded:', response.data.locations.length);
        }
    } catch (error) {
        console.error('Failed to load locations:', error);
    }
}

// Get current weather simulation
async function getCurrentWeather() {
    const location = document.getElementById('location').value;
    const date = document.getElementById('date').value;
    
    let latitude, longitude;
    
    if (location === 'custom') {
        latitude = parseFloat(document.getElementById('latitude').value);
        longitude = parseFloat(document.getElementById('longitude').value);
        
        if (!latitude || !longitude) {
            alert('Please enter both latitude and longitude');
            return;
        }
        
        // Validate coordinates
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            alert('Please enter valid coordinates:\nLatitude: -90 to 90\nLongitude: -180 to 180');
            return;
        }
    } else {
        // Predefined coordinates
        const locations = {
            'new_york': { lat: 40.7128, lon: -74.0060 },
            'los_angeles': { lat: 34.0522, lon: -118.2437 },
            'chicago': { lat: 41.8781, lon: -87.6298 },
            'miami': { lat: 25.7617, lon: -80.1918 }
        };
        
        if (locations[location]) {
            latitude = locations[location].lat;
            longitude = locations[location].lon;
            
            // Auto-fill custom coordinates if showing
            if (document.getElementById('custom-coords').style.display === 'block') {
                document.getElementById('latitude').value = latitude;
                document.getElementById('longitude').value = longitude;
            }
        } else {
            alert('Invalid location selected');
            return;
        }
    }
    
    try {
        showLoading('Fetching simulated weather data...');
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate realistic weather data based on location and date
        const dateObj = new Date(date);
        const month = dateObj.getMonth() + 1;
        const isWinter = month >= 11 || month <= 2;
        const isSummer = month >= 6 && month <= 8;
        
        // Base temperatures by location
        const baseTemps = {
            'new_york': isWinter ? 35 : isSummer ? 80 : 65,
            'los_angeles': isWinter ? 60 : isSummer ? 85 : 75,
            'chicago': isWinter ? 25 : isSummer ? 75 : 60,
            'miami': isWinter ? 75 : isSummer ? 90 : 80,
            'custom': isWinter ? 45 : isSummer ? 75 : 60
        };
        
        const baseTemp = baseTemps[location] || 65;
        
        // Generate realistic weather parameters
        const mockWeatherData = {
            temperature: baseTemp + Math.random() * 10 - 5,
            humidity: 50 + Math.random() * 30,
            pressure: 1013 + Math.random() * 20 - 10,
            wind_speed: 5 + Math.random() * 15,
            precipitation: Math.random() > 0.7 ? Math.random() * 0.5 : 0,
            cloud_cover: 30 + Math.random() * 50
        };
        
        // Populate form with fetched data
        document.getElementById('current-temp').value = mockWeatherData.temperature.toFixed(1);
        document.getElementById('humidity').value = Math.round(mockWeatherData.humidity);
        document.getElementById('pressure').value = Math.round(mockWeatherData.pressure);
        document.getElementById('wind-speed').value = mockWeatherData.wind_speed.toFixed(1);
        document.getElementById('precipitation').value = mockWeatherData.precipitation.toFixed(2);
        document.getElementById('cloud-cover').value = Math.round(mockWeatherData.cloud_cover);
        
        // Use yesterday's temperature as previous day temp (simulated)
        const yesterdayTemp = mockWeatherData.temperature - (2 + Math.random() * 4);
        document.getElementById('prev-day-temp').value = yesterdayTemp.toFixed(1);
        
        hideLoading();
        showSuccess('Weather data simulated successfully!');
        
        // Automatically trigger prediction
        predictFromManualInput();
        
    } catch (error) {
        console.error('Weather simulation error:', error);
        showError('Error simulating weather data. Please enter manually.');
        hideLoading();
    }
}

// Predict from manual input
async function predictFromManualInput() {
    // Get all input values
    const inputData = {
        current_temp: parseFloat(document.getElementById('current-temp').value),
        humidity: parseFloat(document.getElementById('humidity').value),
        pressure: parseFloat(document.getElementById('pressure').value),
        wind_speed: parseFloat(document.getElementById('wind-speed').value),
        precipitation: parseFloat(document.getElementById('precipitation').value),
        cloud_cover: parseFloat(document.getElementById('cloud-cover').value),
        prev_day_temp: parseFloat(document.getElementById('prev-day-temp').value)
    };
    
    // Get location data
    const location = document.getElementById('location').value;
    let latitude, longitude;
    
    if (location === 'custom') {
        latitude = parseFloat(document.getElementById('latitude').value) || 40.7128;
        longitude = parseFloat(document.getElementById('longitude').value) || -74.0060;
    } else {
        const locations = {
            'new_york': { lat: 40.7128, lon: -74.0060 },
            'los_angeles': { lat: 34.0522, lon: -118.2437 },
            'chicago': { lat: 41.8781, lon: -87.6298 },
            'miami': { lat: 25.7617, lon: -80.1918 }
        };
        latitude = locations[location]?.lat || 40.7128;
        longitude = locations[location]?.lon || -74.0060;
    }
    
    // Add location data
    inputData.latitude = latitude;
    inputData.longitude = longitude;
    inputData.elevation = 33; // Default elevation
    
    // Add date information
    const currentDate = new Date();
    inputData.month = currentDate.getMonth() + 1;
    inputData.day_of_week = currentDate.getDay();
    
    // Validate inputs
    const validationErrors = [];
    
    if (isNaN(inputData.current_temp) || inputData.current_temp < -50 || inputData.current_temp > 150) {
        validationErrors.push('Current temperature must be between -50°F and 150°F');
    }
    
    if (isNaN(inputData.humidity) || inputData.humidity < 0 || inputData.humidity > 100) {
        validationErrors.push('Humidity must be between 0% and 100%');
    }
    
    if (isNaN(inputData.pressure) || inputData.pressure < 800 || inputData.pressure > 1100) {
        validationErrors.push('Pressure must be between 800 and 1100 hPa');
    }
    
    if (isNaN(inputData.wind_speed) || inputData.wind_speed < 0 || inputData.wind_speed > 200) {
        validationErrors.push('Wind speed must be between 0 and 200 mph');
    }
    
    if (isNaN(inputData.precipitation) || inputData.precipitation < 0) {
        validationErrors.push('Precipitation cannot be negative');
    }
    
    if (isNaN(inputData.cloud_cover) || inputData.cloud_cover < 0 || inputData.cloud_cover > 100) {
        validationErrors.push('Cloud cover must be between 0% and 100%');
    }
    
    if (isNaN(inputData.prev_day_temp) || inputData.prev_day_temp < -50 || inputData.prev_day_temp > 150) {
        validationErrors.push('Previous day temperature must be between -50°F and 150°F');
    }
    
    if (validationErrors.length > 0) {
        showError(validationErrors.join('\n'));
        return;
    }
    
    try {
        showLoading('Making prediction...');
        
        // Send to Flask backend
        const response = await axios.post(`${API_BASE_URL}/api/predict/single`, inputData);
        const result = response.data;
        
        if (result.success) {
            // Display results
            displayPredictionResult(result, inputData);
            
            // Update feature importance chart
            updateFeatureImportanceChart(result.feature_importance);
            
            // Add to history
            addToHistory(inputData, result.prediction);
            
            // Update trend chart with new prediction
            updateTrendChart(result.prediction.predicted_min_temp);
            
            hideLoading();
            showSuccess('Prediction completed successfully!');
        } else {
            throw new Error(result.error || 'Prediction failed');
        }
        
    } catch (error) {
        console.error('Prediction error:', error);
        showError('Error making prediction: ' + (error.response?.data?.error || error.message));
        hideLoading();
    }
}

// Display prediction result
function displayPredictionResult(result, inputData) {
    const resultsDiv = document.getElementById('prediction-results');
    
    const resultHTML = `
        <div class="prediction-card">
            <div class="prediction-header">
                <h3><i class="fas fa-temperature-low"></i> Minimum Temperature Prediction</h3>
                <span class="confidence-badge" style="background: ${getConfidenceColor(result.prediction.confidence)}">
                    ${result.prediction.confidence}% confident
                </span>
            </div>
            
            <div class="prediction-metrics">
                <div class="metric">
                    <span class="metric-value">${result.prediction.predicted_min_temp}°F</span>
                    <span class="metric-label">Predicted Min Temp</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${inputData.current_temp}°F</span>
                    <span class="metric-label">Current Temp</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${result.prediction.expected_drop}°F</span>
                    <span class="metric-label">Expected Drop</span>
                </div>
            </div>
            
            <div class="prediction-details">
                <h4><i class="fas fa-chart-bar"></i> Input Summary:</h4>
                <div class="input-summary">
                    <span>Humidity: ${inputData.humidity}%</span>
                    <span>Pressure: ${inputData.pressure} hPa</span>
                    <span>Wind: ${inputData.wind_speed} mph</span>
                    <span>Clouds: ${inputData.cloud_cover}%</span>
                    <span>Precip: ${inputData.precipitation}"</span>
                    <span>Prev Temp: ${inputData.prev_day_temp}°F</span>
                    <span>Latitude: ${inputData.latitude.toFixed(4)}</span>
                    <span>Longitude: ${inputData.longitude.toFixed(4)}</span>
                </div>
            </div>
            
            <div class="recommendations">
                <h4><i class="fas fa-lightbulb"></i> ${result.analysis.risk_level.toUpperCase()} RISK - Recommendations:</h4>
                <p>${result.analysis.recommendation}</p>
            </div>
            
            <div style="margin-top: 15px; font-size: 0.9rem; opacity: 0.8;">
                <i class="fas fa-clock"></i> Generated at: ${new Date(result.prediction.timestamp).toLocaleTimeString()}
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = resultHTML;
}

// Update feature importance chart
function updateFeatureImportanceChart(featureImportance) {
    if (!featureImportance || !featureChart) return;
    
    // Sort features by importance
    const sortedFeatures = Object.entries(featureImportance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 11); // Top 11 features
    
    const labels = sortedFeatures.map(([feature]) => 
        feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
    
    const data = sortedFeatures.map(([, importance]) => importance);
    
    featureChart.data.labels = labels;
    featureChart.data.datasets[0].data = data;
    featureChart.update();
}

// Update trend chart with new prediction
function updateTrendChart(newPrediction) {
    if (!trendChart) return;
    
    // Add new prediction to the beginning
    trendChart.data.datasets[0].data.unshift(newPrediction);
    trendChart.data.datasets[0].data.pop(); // Remove oldest
    
    // Update labels
    const newLabels = ['New', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6'];
    trendChart.data.labels = newLabels;
    
    trendChart.update();
}

// Process batch file
async function processBatchFile() {
    const fileInput = document.getElementById('batch-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showError('Please select a CSV file first');
        return;
    }
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
        showError('Please select a CSV file');
        return;
    }
    
    try {
        showLoading('Processing batch file...');
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(`${API_BASE_URL}/api/predict/batch`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        if (response.data.success) {
            displayBatchResults(response.data);
            showSuccess(`Batch processing completed: ${response.data.summary.successful_predictions} successful predictions`);
        } else {
            throw new Error(response.data.error || 'Batch processing failed');
        }
        
        hideLoading();
        
    } catch (error) {
        console.error('Batch processing error:', error);
        showError('Error processing batch file: ' + (error.response?.data?.error || error.message));
        hideLoading();
    }
}

// Display batch results
function displayBatchResults(results) {
    const resultsDiv = document.getElementById('prediction-results');
    
    let tableHTML = `
        <div class="batch-results">
            <h3><i class="fas fa-table"></i> Batch Prediction Results</h3>
            
            <div class="prediction-metrics" style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <div class="metric">
                    <span class="metric-value">${results.summary.total_rows}</span>
                    <span class="metric-label">Total Rows</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${results.summary.successful_predictions}</span>
                    <span class="metric-label">Successful</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${results.summary.avg_predicted_temp}°F</span>
                    <span class="metric-label">Avg Pred Temp</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${results.summary.avg_confidence}%</span>
                    <span class="metric-label">Avg Confidence</span>
                </div>
            </div>
            
            <div class="table-container">
                <table class="batch-table">
                    <thead>
                        <tr>
                            <th>Row</th>
                            <th>Date</th>
                            <th>Input Temp</th>
                            <th>Predicted Min</th>
                            <th>Confidence</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    results.predictions.slice(0, 20).forEach(pred => { // Show first 20 results
        const hasError = pred.error;
        const inputTemp = pred.input_data?.prev_day_temp || 'N/A';
        
        tableHTML += `
            <tr>
                <td>${pred.row_id + 1}</td>
                <td>${pred.date}</td>
                <td>${hasError ? 'N/A' : inputTemp + '°F'}</td>
                <td>${hasError ? 'N/A' : pred.predicted_min_temp + '°F'}</td>
                <td>${hasError ? 'N/A' : `<span class="confidence-badge" style="background: ${getConfidenceColor(pred.confidence)}">${pred.confidence}%</span>`}</td>
                <td>${hasError ? `<span style="color: #dc3545;"><i class="fas fa-exclamation-circle"></i> Error</span>` : '<span style="color: #28a745;"><i class="fas fa-check-circle"></i> Success</span>'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                    </tbody>
                </table>
            </div>
            
            ${results.predictions.length > 20 ? `<p style="text-align: center; color: #666; margin-top: 10px;">Showing first 20 of ${results.predictions.length} predictions</p>` : ''}
            
            <div style="text-align: center; margin-top: 20px;">
                <button class="btn btn-download" onclick="downloadBatchResults(${JSON.stringify(results).replace(/"/g, '&quot;')})">
                    <i class="fas fa-download"></i> Download Results as JSON
                </button>
                <button class="btn btn-upload" onclick="exportBatchToCSV(${JSON.stringify(results).replace(/"/g, '&quot;')})" style="margin-left: 10px;">
                    <i class="fas fa-file-csv"></i> Export as CSV
                </button>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = tableHTML;
}

// Download batch results as JSON
function downloadBatchResults(results) {
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `batch_predictions_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Export batch results to CSV
function exportBatchToCSV(results) {
    if (!results.predictions || results.predictions.length === 0) {
        showError('No data to export');
        return;
    }
    
    const csvRows = [];
    
    // Headers
    const headers = ['Row', 'Date', 'Input_Temp', 'Predicted_Min_Temp', 'Confidence', 'Status', 'Latitude', 'Longitude', 'Humidity', 'Pressure', 'Wind_Speed'];
    csvRows.push(headers.join(','));
    
    // Data rows
    results.predictions.forEach(pred => {
        const row = [
            pred.row_id + 1,
            pred.date,
            pred.input_data?.prev_day_temp || 'N/A',
            pred.predicted_min_temp || 'N/A',
            pred.confidence || 'N/A',
            pred.error ? 'Error' : 'Success',
            pred.input_data?.latitude || 'N/A',
            pred.input_data?.longitude || 'N/A',
            pred.input_data?.humidity || 'N/A',
            pred.input_data?.pressure || 'N/A',
            pred.input_data?.wind_speed || 'N/A'
        ];
        csvRows.push(row.join(','));
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `batch_predictions_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
}

// Load prediction history from API
async function loadPredictionHistory() {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/predictions/history`);
        if (response.data.success) {
            predictionHistory = response.data.predictions;
            updateHistoryTable();
        }
    } catch (error) {
        console.error('Failed to load prediction history:', error);
        // Load from localStorage as fallback
        loadHistoryFromLocalStorage();
    }
}

// Load history from localStorage (fallback)
function loadHistoryFromLocalStorage() {
    const history = JSON.parse(localStorage.getItem('tempPredictionHistory') || '[]');
    predictionHistory = history;
    updateHistoryTable();
}

// Add to history
function addToHistory(inputData, result) {
    const historyEntry = {
        timestamp: new Date().toLocaleTimeString(),
        input_temp: inputData.current_temp,
        predicted_min: result.predicted_min_temp,
        confidence: result.confidence,
        expected_drop: result.expected_drop
    };
    
    predictionHistory.unshift(historyEntry);
    
    // Keep only last 10 entries
    if (predictionHistory.length > 10) {
        predictionHistory = predictionHistory.slice(0, 10);
    }
    
    // Save to localStorage as backup
    localStorage.setItem('tempPredictionHistory', JSON.stringify(predictionHistory));
    
    updateHistoryTable();
}

// Update history table
function updateHistoryTable() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = '';
    
    if (predictionHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: #666; padding: 20px;">
                    <i class="fas fa-history"></i> No prediction history yet
                </td>
            </tr>
        `;
        return;
    }
    
    predictionHistory.forEach(entry => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.timestamp}</td>
            <td>${entry.input_temp}°F</td>
            <td>${entry.predicted_min}°F</td>
            <td><span class="confidence-badge" style="background: ${getConfidenceColor(entry.confidence)}">
                ${entry.confidence}%
            </span></td>
        `;
        tbody.appendChild(row);
    });
}

// Get model info
async function getModelInfo() {
    try {
        showLoading('Fetching model information...');
        const response = await axios.get(`${API_BASE_URL}/api/model/info`);
        
        if (response.data.success) {
            const info = response.data.model_info;
            const infoText = `
                Model Type: ${info.model_type}
                Features: ${info.feature_count}
                Last Trained: ${new Date(info.last_trained).toLocaleString()}
                Features Used: ${info.features.join(', ')}
            `;
            
            alert(`Model Information:\n\n${infoText}`);
        }
        hideLoading();
    } catch (error) {
        console.error('Failed to get model info:', error);
        showError('Failed to get model information');
        hideLoading();
    }
}

// Retrain model
async function retrainModel() {
    if (!confirm('Are you sure you want to retrain the model? This may take a few moments.')) {
        return;
    }
    
    try {
        showLoading('Retraining model...');
        const response = await axios.post(`${API_BASE_URL}/api/model/retrain`);
        
        if (response.data.success) {
            showSuccess('Model retrained successfully!');
            // Reload model info
            getModelInfo();
        } else {
            throw new Error(response.data.error || 'Retraining failed');
        }
        hideLoading();
    } catch (error) {
        console.error('Failed to retrain model:', error);
        showError('Failed to retrain model: ' + (error.response?.data?.error || error.message));
        hideLoading();
    }
}

// Get confidence color
function getConfidenceColor(confidence) {
    if (confidence >= 85) return '#28a745';
    if (confidence >= 70) return '#ffc107';
    if (confidence >= 60) return '#fd7e14';
    return '#dc3545';
}

// Show loading state
function showLoading(message) {
    document.getElementById('api-status').textContent = message;
    document.getElementById('api-status').style.color = '#ffc107';
    
    // Disable buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    });
}

// Hide loading state
function hideLoading() {
    document.getElementById('api-status').textContent = 'Ready';
    document.getElementById('api-status').style.color = '#28a745';
    
    // Re-enable buttons
    document.querySelectorAll('button').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
}

// Show success message
function showSuccess(message) {
    const oldStatus = document.getElementById('api-status').textContent;
    document.getElementById('api-status').textContent = '✓ ' + message;
    document.getElementById('api-status').style.color = '#28a745';
    
    // Revert after 3 seconds
    setTimeout(() => {
        document.getElementById('api-status').textContent = oldStatus;
        document.getElementById('api-status').style.color = '#28a745';
    }, 3000);
}

// Show error message
function showError(message) {
    const oldStatus = document.getElementById('api-status').textContent;
    document.getElementById('api-status').textContent = '✗ ' + message;
    document.getElementById('api-status').style.color = '#dc3545';
    
    // Revert after 5 seconds
    setTimeout(() => {
        document.getElementById('api-status').textContent = oldStatus;
        document.getElementById('api-status').style.color = '#28a745';
    }, 5000);
}

// Utility function to format date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Clear form function (optional)
function clearForm() {
    document.getElementById('current-temp').value = '';
    document.getElementById('humidity').value = '';
    document.getElementById('pressure').value = '';
    document.getElementById('wind-speed').value = '';
    document.getElementById('precipitation').value = '';
    document.getElementById('cloud-cover').value = '';
    document.getElementById('prev-day-temp').value = '';
    
    const resultsDiv = document.getElementById('prediction-results');
    resultsDiv.innerHTML = `
        <div class="no-prediction">
            <i class="fas fa-chart-bar fa-3x"></i>
            <p>Enter weather data to get predictions</p>
        </div>
    `;
    
    showSuccess('Form cleared');
}