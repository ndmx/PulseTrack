#!/usr/bin/env python3
"""
Convert state_demographics.csv to JSON for frontend consumption
Preserves all demographic data including tribal, religious, and employment data
Uses only standard library (no dependencies)
"""

import csv
import json
from pathlib import Path

def main():
    project_root = Path(__file__).resolve().parents[1]
    csv_path = project_root / 'backend' / 'legacy' / 'data' / 'state_demographics.csv'
    output_path = project_root / 'frontend' / 'public' / 'snapstats' / 'state_demographics.json'
    
    print("=" * 60)
    print("Converting state_demographics.csv to JSON")
    print("=" * 60)
    
    # Read CSV
    if not csv_path.exists():
        print(f"❌ ERROR: {csv_path} not found!")
        print(f"   Looking in: {csv_path}")
        return False
    
    states = []
    totals = {
        'total_population': 0,
        'voting_age_population': 0,
        'registered_voters': 0
    }
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            state_data = {
                'state': row['state'],
                'total_population': int(row['total_population']),
                'voting_age_population': int(row['voting_age_population']),
                'registered_voters': int(row['registered_voters']),
                'political_affiliation': row['political_affiliation'],
                'tribal_affiliation': row['tribal_affiliation'],
                'employment_rate': float(row['employment_rate']),
                'marriage_status': row['marriage_status'],
                'religious_affiliation': row['religious_affiliation']
            }
            states.append(state_data)
            
            # Update totals
            totals['total_population'] += state_data['total_population']
            totals['voting_age_population'] += state_data['voting_age_population']
            totals['registered_voters'] += state_data['registered_voters']
    
    print(f"✅ Loaded CSV: {len(states)} states")
    
    # Create structured JSON
    data = {
        'totals': totals,
        'states': states
    }
    
    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Write JSON
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Converted {len(states)} states to JSON")
    print(f"📁 Output: {output_path}")
    print("")
    print("📊 Data includes:")
    print("   • Total population, voting age, registered voters")
    print("   • Political affiliation (APC, PDP, LP, NNPP)")
    print("   • Tribal affiliation (Yoruba, Igbo, Hausa, etc.)")
    print("   • Employment rates")
    print("   • Religious affiliation (Christian, Muslim, Mixed)")
    print("")
    print("=" * 60)
    print("✅ Conversion complete!")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

