# Firebase Cloud Functions (Python 3.12)
# Deploy with: firebase deploy --only functions

from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app, firestore
import google.cloud.firestore
import json

# Initialize Firebase Admin
initialize_app()


@https_fn.on_request()
def healthz(req: https_fn.Request) -> https_fn.Response:
    """Health check endpoint"""
    return https_fn.Response(
        json.dumps({"ok": True}),
        status=200,
        headers={"Content-Type": "application/json"}
    )


@https_fn.on_request()
def submit_opinion(req: https_fn.Request) -> https_fn.Response:
    """Handle opinion submission from frontend"""
    headers = {"Content-Type": "application/json"}
    
    if req.method != "POST":
        return https_fn.Response(
            json.dumps({"error": "Method not allowed"}),
            status=405,
            headers=headers
        )
    
    try:
        data = req.get_json()
        db = firestore.client()
        
        # Validate input
        required_fields = ['source', 'content', 'user_id', 'location', 'candidate']
        if not all(field in data for field in required_fields):
            return https_fn.Response(
                json.dumps({"error": "Missing required fields"}),
                status=400,
                headers=headers
            )
        
        # Add timestamp
        data['timestamp'] = firestore.SERVER_TIMESTAMP
        
        # Write to Firestore
        db.collection('raw_inputs').add(data)
        
        return https_fn.Response(
            json.dumps({"success": True, "message": "Opinion submitted"}),
            status=201,
            headers=headers
        )
    except Exception as e:
        return https_fn.Response(
            json.dumps({"error": str(e)}),
            status=500,
            headers=headers
        )


@scheduler_fn.on_schedule(schedule="every 10 minutes")
def process_etl(event: scheduler_fn.ScheduledEvent) -> None:
    """
    ETL pipeline - runs every 10 minutes
    Processes raw_inputs, calculates sentiment, updates approval_ratings
    """
    from etl_processor import calculate_sentiment, calculate_approval_score, aggregate_sentiments
    from datetime import datetime, timedelta
    
    try:
        db = firestore.client()
        
        # Fetch unprocessed raw_inputs from last 15 minutes
        cutoff = datetime.now() - timedelta(minutes=15)
        inputs_ref = db.collection('raw_inputs').where('timestamp', '>=', cutoff).stream()
        
        # Group by candidate
        candidate_data = {}
        for doc in inputs_ref:
            data = doc.data()
            candidate = data.get('candidate', 'Unknown')
            content = data.get('content', '')
            
            if candidate not in candidate_data:
                candidate_data[candidate] = {'inputs': [], 'sentiments': []}
            
            sentiment = calculate_sentiment(content)
            candidate_data[candidate]['inputs'].append(doc.id)
            candidate_data[candidate]['sentiments'].append(sentiment)
        
        # Process each candidate
        for candidate, info in candidate_data.items():
            if not info['sentiments']:
                continue
                
            # Aggregate sentiments
            avg_sentiment = aggregate_sentiments(info['sentiments'])
            approval_score = calculate_approval_score(avg_sentiment)
            
            # Write sentiment_breakdown
            db.collection('sentiment_breakdown').add({
                'timestamp': firestore.SERVER_TIMESTAMP,
                'candidate': candidate,
                'positive': avg_sentiment['positive'],
                'negative': avg_sentiment['negative'],
                'neutral': avg_sentiment['neutral'],
                'trending_phrases': '',
                'headlines': f"{len(info['inputs'])} new opinions processed"
            })
            
            # Calculate change delta (compare with last rating)
            last_rating_query = db.collection('approval_ratings')\
                .where('candidate', '==', candidate)\
                .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                .limit(1)\
                .stream()
            
            last_rating = None
            for doc in last_rating_query:
                last_rating = doc.data().get('rating_score', 0)
                break
            
            change_delta = approval_score - (last_rating or 0)
            
            # Write approval_ratings
            db.collection('approval_ratings').add({
                'timestamp': firestore.SERVER_TIMESTAMP,
                'candidate': candidate,
                'rating_score': approval_score,
                'change_delta': round(change_delta, 2),
                'state': 'National'
            })
        
        print(f"ETL processed {sum(len(info['inputs']) for info in candidate_data.values())} inputs")
        
    except Exception as e:
        print(f"ETL error: {e}")
        raise


# Additional functions for backend API endpoints
@https_fn.on_request()
def admin_upload(req: https_fn.Request) -> https_fn.Response:
    """Admin endpoint for file uploads (with API key authentication)"""
    # TODO: Implement file upload handler
    # Verify API key from headers
    # Process uploaded CSV files
    # Trigger ETL pipeline
    return https_fn.Response(
        json.dumps({"not_implemented": True}),
        status=501,
        headers={"Content-Type": "application/json"}
    )

