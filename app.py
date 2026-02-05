from flask import Flask, render_template, request, jsonify, send_file, session
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import json
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import warnings
warnings.filterwarnings('ignore')

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'temperature_prediction_secret_key_2024'
CORS(app)

# Configuration
app.config.update(
    UPLOAD_FOLDER='uploads',
    DATA_FOLDER='data',
    MODEL_FOLDER='models',
    MAX_CONTENT_LENGTH=16 * 1024 * 1024  # 16MB max file size
)

# Create necessary directories
for folder in [app.config['UPLOAD_FOLDER'], app.config['DATA_FOLDER'], app.config['MODEL_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# File paths
HISTORICAL_DATA_PATH = os.path.join(app.config['DATA_FOLDER'], 'historical_weather.csv')
TRAINING_DATA_PATH = os.path.join(app.config['DATA_FOLDER'], 'training_data.csv')
MODEL_PATH = os.path.join(app.config['MODEL_FOLDER'], 'temperature_model.pkl')
SCALER_PATH = os.path.join(app.config['MODEL_FOLDER'], 'scaler.pkl')

# Global variables
model = None
scaler = None
feature_columns = None

# ==================== HELPER FUNCTIONS ====================

def create_sample_historical_data():
    """Create sample historical weather data if none exists"""
    dates = []
    temperatures = []
    base_date = datetime.now() - timedelta(days=365)
    
    for i in range(365):
        current_date = base_date + timedelta(days=i)
        dates.append(current_date.strftime('%Y-%m-%d'))
        
        # Create realistic temperature pattern with seasonality
        seasonal_component = 15 * np.sin(2 * np.pi * i / 365)
        random_component = np.random.normal(0, 5)
        base_temp = 65 + seasonal_component + random_component
        
        temperatures.append({
            'date': current_date.strftime('%Y-%m-%d'),
            'min_temp_f': round(base_temp - np.random.uniform(5, 15), 1),
            'max_temp_f': round(base_temp + np.random.uniform(5, 15), 1),
            'avg_temp_f': round(base_temp, 1),
            'humidity': np.random.randint(40, 85),
            'pressure': np.random.randint(990, 1020),
            'wind_speed': round(np.random.exponential(5), 1),
            'precipitation': round(np.random.exponential(0.1), 2),
            'cloud_cover': np.random.randint(0, 100),
            'month': current_date.month,
            'day_of_week': current_date.weekday(),
            'season': (current_date.month % 12 + 3) // 3  # 1:Winter, 2:Spring, etc.
        })
    
    df = pd.DataFrame(temperatures)
    df.to_csv(HISTORICAL_DATA_PATH, index=False)
    return df

def create_training_data():
    """Create training data for the model"""
    # Generate synthetic training data
    np.random.seed(42)
    n_samples = 1000
    
    # Create feature matrix
    X = pd.DataFrame({
        'humidity': np.random.uniform(30, 90, n_samples),
        'pressure': np.random.uniform(980, 1030, n_samples),
        'wind_speed': np.random.exponential(5, n_samples),
        'precipitation': np.random.exponential(0.1, n_samples),
        'cloud_cover': np.random.uniform(0, 100, n_samples),
        'month': np.random.randint(1, 13, n_samples),
        'day_of_week': np.random.randint(0, 7, n_samples),
        'prev_day_temp': np.random.uniform(50, 85, n_samples),
        'latitude': np.random.uniform(25, 45, n_samples),
        'longitude': np.random.uniform(-125, -65, n_samples),
        'elevation': np.random.exponential(500, n_samples)
    })
    
    # Create target variable (minimum temperature)
    # Simulate relationships between features and target
    y = (
        65 +  # Base temperature
        0.2 * X['humidity'] +
        -0.1 * X['pressure'] +
        -0.5 * X['wind_speed'] +
        -2.0 * X['precipitation'] +
        -0.05 * X['cloud_cover'] +
        2.0 * np.sin(2 * np.pi * (X['month'] - 1) / 12) +  # Seasonal effect
        np.random.normal(0, 3, n_samples)  # Random noise
    )
    
    # Ensure temperatures are realistic
    y = np.clip(y, 20, 100)
    
    # Combine features and target
    training_data = X.copy()
    training_data['min_temp_f'] = y
    
    training_data.to_csv(TRAINING_DATA_PATH, index=False)
    return training_data

def train_model():
    """Train or retrain the temperature prediction model"""
    global model, scaler, feature_columns
    
    try:
        # Load or create training data
        if os.path.exists(TRAINING_DATA_PATH):
            df = pd.read_csv(TRAINING_DATA_PATH)
        else:
            df = create_training_data()
        
        # Define features and target
        feature_columns = ['humidity', 'pressure', 'wind_speed', 'precipitation', 
                          'cloud_cover', 'month', 'day_of_week', 'prev_day_temp',
                          'latitude', 'longitude', 'elevation']
        
        X = df[feature_columns]
        y = df['min_temp_f']
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train Random Forest model
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        
        model.fit(X_train_scaled, y_train)
        
        # Calculate training metrics
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)
        
        # Save model and scaler
        joblib.dump(model, MODEL_PATH)
        joblib.dump(scaler, SCALER_PATH)
        
        # Save feature columns
        with open(os.path.join(app.config['MODEL_FOLDER'], 'feature_columns.json'), 'w') as f:
            json.dump(feature_columns, f)
        
        print(f"Model trained successfully! Train R²: {train_score:.3f}, Test R²: {test_score:.3f}")
        return True
        
    except Exception as e:
        print(f"Error training model: {str(e)}")
        return False

def load_model():
    """Load the trained model and scaler"""
    global model, scaler, feature_columns
    
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            
            # Load feature columns
            feature_path = os.path.join(app.config['MODEL_FOLDER'], 'feature_columns.json')
            if os.path.exists(feature_path):
                with open(feature_path, 'r') as f:
                    feature_columns = json.load(f)
            else:
                feature_columns = ['humidity', 'pressure', 'wind_speed', 'precipitation', 
                                  'cloud_cover', 'month', 'day_of_week', 'prev_day_temp',
                                  'latitude', 'longitude', 'elevation']
            
            print("Model loaded successfully")
            return True
        else:
            print("No trained model found. Training new model...")
            return train_model()
            
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        return False

def predict_min_temperature(input_data):
    """Make prediction using the trained model"""
    global model, scaler, feature_columns
    
    if model is None or scaler is None:
        if not load_model():
            raise Exception("Model not available for prediction")
    
    try:
        # Prepare input DataFrame with all required features
        prediction_input = {}
        
        # Extract or compute all required features
        current_date = datetime.now()
        
        # Required features with defaults if not provided
        prediction_input['humidity'] = input_data.get('humidity', 65.0)
        prediction_input['pressure'] = input_data.get('pressure', 1013.0)
        prediction_input['wind_speed'] = input_data.get('wind_speed', 8.2)
        prediction_input['precipitation'] = input_data.get('precipitation', 0.0)
        prediction_input['cloud_cover'] = input_data.get('cloud_cover', 50.0)
        prediction_input['month'] = input_data.get('month', current_date.month)
        prediction_input['day_of_week'] = input_data.get('day_of_week', current_date.weekday())
        prediction_input['prev_day_temp'] = input_data.get('prev_day_temp', 68.0)
        prediction_input['latitude'] = input_data.get('latitude', 40.7128)
        prediction_input['longitude'] = input_data.get('longitude', -74.0060)
        prediction_input['elevation'] = input_data.get('elevation', 33.0)
        
        # Create DataFrame
        input_df = pd.DataFrame([prediction_input])
        
        # Ensure all feature columns are present
        for col in feature_columns:
            if col not in input_df.columns:
                input_df[col] = 0  # Default value for missing columns
        
        # Reorder columns to match training
        input_df = input_df[feature_columns]
        
        # Scale features
        input_scaled = scaler.transform(input_df)
        
        # Make prediction
        prediction = model.predict(input_scaled)[0]
        
        # Get feature importance for analysis
        feature_importance = dict(zip(feature_columns, model.feature_importances_))
        
        # Calculate confidence based on prediction variance
        # (using tree variance from Random Forest)
        tree_predictions = [tree.predict(input_scaled)[0] for tree in model.estimators_]
        confidence = max(60, min(95, 100 - np.std(tree_predictions) * 5))
        
        return {
            'predicted_min_temp': round(prediction, 1),
            'confidence': round(confidence, 1),
            'feature_importance': feature_importance,
            'tree_predictions': [round(p, 1) for p in tree_predictions[:10]]  # First 10 trees
        }
        
    except Exception as e:
        raise Exception(f"Prediction error: {str(e)}")

def analyze_weather_trends(data):
    """Analyze weather data for insights"""
    if len(data) == 0:
        return {}
    
    df = pd.DataFrame(data)
    analysis = {}
    
    if 'min_temp_f' in df.columns:
        temps = df['min_temp_f']
        analysis['temperature'] = {
            'average': round(temps.mean(), 1),
            'minimum': round(temps.min(), 1),
            'maximum': round(temps.max(), 1),
            'std_dev': round(temps.std(), 2),
            'trend': 'increasing' if len(temps) > 1 and temps.iloc[-1] > temps.iloc[0] else 'decreasing'
        }
    
    if 'humidity' in df.columns:
        humidity = df['humidity']
        analysis['humidity'] = {
            'average': round(humidity.mean(), 1),
            'range': f"{int(humidity.min())}-{int(humidity.max())}%"
        }
    
    return analysis

def generate_future_predictions(days=7):
    """Generate weather predictions for next N days"""
    predictions = []
    current_date = datetime.now()
    
    for i in range(1, days + 1):
        prediction_date = current_date + timedelta(days=i)
        
        # Simulate prediction (in real app, this would use weather forecast API)
        base_temp = 65 + 10 * np.sin(i * 0.5)  # Seasonal pattern
        predicted_min = base_temp + np.random.normal(0, 3)
        predicted_max = predicted_min + np.random.uniform(10, 20)
        
        predictions.append({
            'date': prediction_date.strftime('%Y-%m-%d'),
            'day_name': prediction_date.strftime('%A'),
            'day': f'Day {i}',
            'predicted_min_temp': round(max(20, min(90, predicted_min)), 1),
            'predicted_max_temp': round(max(30, min(100, predicted_max)), 1),
            'humidity': np.random.randint(40, 80),
            'precipitation_chance': round(np.random.uniform(0, 40), 1),
            'confidence': round(80 + np.random.uniform(-10, 10), 1)
        })
    
    return predictions

# ==================== ROUTES ====================

@app.route('/')
def index():
    """Render the main application page"""
    current_date = datetime.now().strftime('%Y-%m-%d')
    return render_template('index.html', current_date=current_date)

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': model is not None
    })

@app.route('/api/data/historical', methods=['GET'])
def get_historical_data():
    """Get historical weather data"""
    try:
        if os.path.exists(HISTORICAL_DATA_PATH):
            df = pd.read_csv(HISTORICAL_DATA_PATH)
        else:
            df = create_sample_historical_data()
        
        # Convert to list of dictionaries for JSON response
        data = df.to_dict('records')
        
        # Get analysis
        analysis = analyze_weather_trends(data)
        
        return jsonify({
            'success': True,
            'data': data[:100],  # Limit to 100 records for performance
            'analysis': analysis,
            'total_records': len(data),
            'date_range': {
                'start': df['date'].min() if 'date' in df.columns else 'N/A',
                'end': df['date'].max() if 'date' in df.columns else 'N/A'
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/predict/single', methods=['POST'])
def predict_single():
    """Make a single temperature prediction"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Make prediction
        result = predict_min_temperature(data)
        
        # Get current temperature for comparison
        current_temp = data.get('current_temp', 70.0)
        
        response = {
            'success': True,
            'prediction': {
                'input_current_temp': current_temp,
                'predicted_min_temp': result['predicted_min_temp'],
                'expected_drop': round(current_temp - result['predicted_min_temp'], 1),
                'confidence': result['confidence'],
                'timestamp': datetime.now().isoformat()
            },
            'analysis': {
                'risk_level': 'high' if result['predicted_min_temp'] < 32 else 
                             'medium' if result['predicted_min_temp'] < 50 else 'low',
                'recommendation': get_recommendation(result['predicted_min_temp'])
            },
            'feature_importance': result['feature_importance']
        }
        
        # Store in session for history
        if 'predictions' not in session:
            session['predictions'] = []
        
        session['predictions'].append({
            'timestamp': datetime.now().isoformat(),
            'input': data,
            'prediction': response['prediction']
        })
        
        # Keep only last 20 predictions
        if len(session['predictions']) > 20:
            session['predictions'] = session['predictions'][-20:]
        
        return jsonify(response)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/predict/batch', methods=['POST'])
def predict_batch():
    """Make batch predictions from CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not file.filename.endswith('.csv'):
            return jsonify({'success': False, 'error': 'File must be CSV'}), 400
        
        # Save uploaded file
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
        file.save(filepath)
        
        # Read CSV
        df = pd.read_csv(filepath)
        
        # Process each row
        predictions = []
        for idx, row in df.iterrows():
            try:
                # Prepare input data
                input_data = {
                    'humidity': float(row.get('humidity', 65)),
                    'pressure': float(row.get('pressure', 1013)),
                    'wind_speed': float(row.get('wind_speed', 8.2)),
                    'precipitation': float(row.get('precipitation', 0)),
                    'cloud_cover': float(row.get('cloud_cover', 50)),
                    'prev_day_temp': float(row.get('prev_day_temp', 68)),
                    'month': int(row.get('month', datetime.now().month)),
                    'day_of_week': int(row.get('day_of_week', datetime.now().weekday())),
                    'latitude': float(row.get('latitude', 40.7128)),
                    'longitude': float(row.get('longitude', -74.0060)),
                    'elevation': float(row.get('elevation', 33))
                }
                
                # Make prediction
                result = predict_min_temperature(input_data)
                
                predictions.append({
                    'row_id': idx,
                    'date': str(row.get('date', 'N/A')),
                    'input_data': input_data,
                    'predicted_min_temp': result['predicted_min_temp'],
                    'confidence': result['confidence']
                })
                
            except Exception as e:
                predictions.append({
                    'row_id': idx,
                    'error': str(e),
                    'predicted_min_temp': None,
                    'confidence': 0
                })
        
        # Generate summary statistics
        successful_preds = [p for p in predictions if p['predicted_min_temp'] is not None]
        
        summary = {
            'total_rows': len(df),
            'successful_predictions': len(successful_preds),
            'failed_predictions': len(predictions) - len(successful_preds),
            'avg_predicted_temp': round(np.mean([p['predicted_min_temp'] for p in successful_preds]), 1) if successful_preds else 0,
            'avg_confidence': round(np.mean([p['confidence'] for p in successful_preds]), 1) if successful_preds else 0
        }
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'summary': summary,
            'file_path': filepath
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """Get weather forecast for next 7 days"""
    try:
        predictions = generate_future_predictions(7)
        
        # Calculate statistics
        min_temps = [p['predicted_min_temp'] for p in predictions]
        max_temps = [p['predicted_max_temp'] for p in predictions]
        
        return jsonify({
            'success': True,
            'forecast': predictions,
            'statistics': {
                'avg_min_temp': round(np.mean(min_temps), 1),
                'avg_max_temp': round(np.mean(max_temps), 1),
                'coldest_day': predictions[np.argmin(min_temps)]['day_name'],
                'warmest_day': predictions[np.argmax(max_temps)]['day_name']
            },
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/model/info', methods=['GET'])
def get_model_info():
    """Get information about the trained model"""
    try:
        if model is None:
            return jsonify({'success': False, 'error': 'Model not loaded'}), 404
        
        model_info = {
            'model_type': type(model).__name__,
            'n_estimators': model.n_estimators if hasattr(model, 'n_estimators') else 'N/A',
            'feature_count': len(feature_columns) if feature_columns else 0,
            'features': feature_columns if feature_columns else [],
            'last_trained': datetime.fromtimestamp(os.path.getctime(MODEL_PATH)).isoformat() if os.path.exists(MODEL_PATH) else 'N/A'
        }
        
        return jsonify({'success': True, 'model_info': model_info})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/model/retrain', methods=['POST'])
def retrain_model():
    """Retrain the model with new data"""
    try:
        success = train_model()
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Model retrained successfully',
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to retrain model'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/upload', methods=['POST'])
def upload_data():
    """Upload new weather data"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        if not file.filename.endswith('.csv'):
            return jsonify({'success': False, 'error': 'File must be CSV'}), 400
        
        # Read the uploaded file
        new_data = pd.read_csv(file)
        
        # Validate required columns
        required_columns = ['date', 'min_temp_f']
        for col in required_columns:
            if col not in new_data.columns:
                return jsonify({'success': False, 'error': f'Missing required column: {col}'}), 400
        
        # Load existing data
        if os.path.exists(HISTORICAL_DATA_PATH):
            existing_data = pd.read_csv(HISTORICAL_DATA_PATH)
            combined_data = pd.concat([existing_data, new_data], ignore_index=True)
        else:
            combined_data = new_data
        
        # Remove duplicates based on date
        combined_data = combined_data.drop_duplicates(subset=['date'], keep='last')
        
        # Save combined data
        combined_data.to_csv(HISTORICAL_DATA_PATH, index=False)
        
        return jsonify({
            'success': True,
            'message': f'Successfully uploaded {len(new_data)} records',
            'total_records': len(combined_data),
            'new_records': len(new_data)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/export', methods=['GET'])
def export_data():
    """Export data as CSV"""
    try:
        if os.path.exists(HISTORICAL_DATA_PATH):
            return send_file(
                HISTORICAL_DATA_PATH,
                as_attachment=True,
                download_name=f'weather_data_export_{datetime.now().strftime("%Y%m%d")}.csv',
                mimetype='text/csv'
            )
        else:
            return jsonify({'success': False, 'error': 'No data available to export'}), 404
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/predictions/history', methods=['GET'])
def get_prediction_history():
    """Get prediction history from session"""
    try:
        predictions = session.get('predictions', [])
        
        return jsonify({
            'success': True,
            'predictions': predictions[-10:],  # Last 10 predictions
            'total_count': len(predictions)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/weather/locations', methods=['GET'])
def get_locations():
    """Get available weather locations"""
    locations = [
        {'id': 'new_york', 'name': 'New York', 'lat': 40.7128, 'lon': -74.0060},
        {'id': 'los_angeles', 'name': 'Los Angeles', 'lat': 34.0522, 'lon': -118.2437},
        {'id': 'chicago', 'name': 'Chicago', 'lat': 41.8781, 'lon': -87.6298},
        {'id': 'miami', 'name': 'Miami', 'lat': 25.7617, 'lon': -80.1918},
        {'id': 'houston', 'name': 'Houston', 'lat': 29.7604, 'lon': -95.3698},
        {'id': 'phoenix', 'name': 'Phoenix', 'lat': 33.4484, 'lon': -112.0740}
    ]
    
    return jsonify({'success': True, 'locations': locations})

def get_recommendation(temperature):
    """Get recommendation based on predicted temperature"""
    if temperature < 32:
        return "Freezing temperatures expected. Protect pipes, bring pets indoors, and use caution on roads."
    elif temperature < 50:
        return "Cold temperatures expected. Dress in layers, protect sensitive plants."
    elif temperature < 65:
        return "Cool temperatures. Light jacket recommended for evening."
    else:
        return "Mild temperatures expected. Comfortable conditions for outdoor activities."

# ==================== INITIALIZATION ====================

# FIXED: Remove @app.before_first_request decorator and use a function instead
def initialize_app():
    """Initialize the application before first request"""
    print("Initializing Temperature Prediction Application...")
    
    # Load or train model
    print("Loading machine learning model...")
    load_model()
    
    # Create sample data if needed
    if not os.path.exists(HISTORICAL_DATA_PATH):
        print("Creating sample historical data...")
        create_sample_historical_data()
    
    if not os.path.exists(TRAINING_DATA_PATH):
        print("Creating training data...")
        create_training_data()
    
    print("Application initialized successfully!")
    print(f"Historical data: {HISTORICAL_DATA_PATH}")
    print(f"Model: {'Loaded' if model else 'Not loaded'}")
    print("Access the application at: http://localhost:5000")

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    # Initialize the application before starting
    initialize_app()
    
    print("\n" + "="*50)
    print("TEMPERATURE PREDICTION APPLICATION")
    print("="*50)
    print(f"Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Debug mode: {app.debug}")
    print(f"Model loaded: {model is not None}")
    print("="*50)
    print("\nStarting server...")
    
    app.run(debug=True, host='0.0.0.0', port=5000)