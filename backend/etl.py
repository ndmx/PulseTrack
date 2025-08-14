import requests
import geopandas as gpd
import pandas as pd
import os
import json
from pathlib import Path

class NigeriaDataETL:
    def __init__(self):
        base_dir = Path(__file__).resolve().parent
        self.data_dir = str(base_dir / 'data')
        self.raw_dir = os.path.join(self.data_dir, 'raw')
        self.processed_dir = os.path.join(self.data_dir, 'processed')
        self.metadata_dir = os.path.join(self.data_dir, 'metadata')
        
        # Prefer processed sources going forward
        self.processed_geojson_file = os.path.join(self.processed_dir, 'nigeria_states.geojson')
        # Legacy/raw sources (optional fallback)
        self.raw_geojson_file = os.path.join(self.raw_dir, 'nigeria_states.geojson')
        self.raw_area_file = os.path.join(self.raw_dir, 'nigeria_states_data.csv')
        # Political/tribal enrichment per state (optional; prefer already embedded in processed geojson)
        self.states_demographic_file = os.path.join(self.raw_dir, 'states_zones_parties_tribes.csv')
        self.tribes_file = os.path.join(self.raw_dir, 'tribes.csv')
        # Extended demographics per state (totals, registered_voters, etc.) now in processed directory
        self.state_demographics_file = os.path.join(self.processed_dir, 'state_demographics.csv')
        
        # Processed data files
        self.processed_file = self.processed_geojson_file
        
        # Ensure directories exist
        for directory in [self.raw_dir, self.processed_dir, self.metadata_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)

    @staticmethod
    def normalize_state_series(series: pd.Series) -> pd.Series:
        """Normalize state names for robust matching; collapse FCT variants to 'abuja'."""
        s = series.astype(str).str.strip().str.lower()
        # Replace common variants for the Federal Capital Territory
        s = s.str.replace(r"\babuja\s*federal\s*capital\s*territory\b", "abuja", regex=True)
        s = s.str.replace(r"\bfederal\s*capital\s*territory\b", "abuja", regex=True)
        s = s.str.replace(r"\bfct\.?\b", "abuja", regex=True)
        s = s.str.replace(r"\bfct\s*abuja\b", "abuja", regex=True)
        s = s.str.replace(r"\s+", " ", regex=True)
        return s
        
    def fetch_data(self):
        """Fetch Nigeria states GeoJSON data from geoBoundaries"""
        try:
            # If we already have a processed geojson, prefer it and skip fetch
            if os.path.exists(self.processed_geojson_file):
                print("Processed geojson found; skipping fetch")
                return True
            # URL for Nigeria states data from geoBoundaries
            url = "https://www.geoboundaries.org/api/current/gbOpen/NGA/ADM1/"
            
            print("Fetching Nigeria states data...")
            response = requests.get(url)
            response.raise_for_status()
            
            # Get the download URL from the response
            data = response.json()
            download_url = data['gjDownloadURL']
            
            # Download the actual GeoJSON file
            print("Downloading GeoJSON file...")
            geojson_response = requests.get(download_url)
            geojson_response.raise_for_status()
            
    # Create data directory if it doesn't exist
            if not os.path.exists(self.data_dir):
                os.makedirs(self.data_dir)
            
            # Save to processed directly when using fetch fallback
            with open(self.processed_geojson_file, 'w') as f:
                f.write(geojson_response.text)
            
            print(f"Data saved to {self.processed_geojson_file}")
            return True
            
        except Exception as e:
            print(f"Error fetching data: {str(e)}")
            return False
    
    def load_demographic_data(self):
        """Load enrichment CSV data for merging and derived stats"""
        try:
            print("Loading demographic data...")
            
            # Load per-state political/tribal enrichment
            if os.path.exists(self.states_demographic_file):
                states_demo = pd.read_csv(self.states_demographic_file)
                print(f"Loaded states political/tribal: {len(states_demo)} rows")
            else:
                print(f"Warning: {self.states_demographic_file} not found")
                states_demo = None
            
            # Load per-state extended demographics (totals, voters, etc.)
            if os.path.exists(self.state_demographics_file):
                demo_stats = pd.read_csv(self.state_demographics_file)
                print(f"Loaded state_demographics: {len(demo_stats)} rows")
            else:
                print(f"Warning: {self.state_demographics_file} not found")
                demo_stats = None

            # Load tribes data
            if os.path.exists(self.tribes_file):
                tribes_data = pd.read_csv(self.tribes_file)
                print(f"Loaded tribes data: {len(tribes_data)} ethnic groups")
            else:
                print(f"Warning: {self.tribes_file} not found")
                tribes_data = None
            
            return states_demo, demo_stats, tribes_data
            
        except Exception as e:
            print(f"Error loading demographic data: {str(e)}")
            return None, None, None
    
    def merge_demographic_data(self, gdf, states_demo, demo_stats):
        """Merge political/tribal and extended demographics with GeoJSON data"""
        try:
            print("Merging demographic data...")
            
            if states_demo is None:
                print("No political/tribal enrichment to merge")
            else:
                # Normalize names for robust join
                if 'State' in states_demo.columns and 'state' not in states_demo.columns:
                    states_demo = states_demo.rename(columns={'State': 'state'})
                gdf['shapeName_norm'] = self.normalize_state_series(gdf['shapeName'])
                states_demo['state_norm'] = self.normalize_state_series(states_demo['state'])

                geo_states = set(gdf['shapeName_norm'].unique())
                demo_states = set(states_demo['state_norm'].unique())
                missing_in_demo = geo_states - demo_states
                missing_in_geo = demo_states - geo_states
                if missing_in_demo:
                    print(f"States in GeoJSON but missing in states_zones_parties_tribes.csv: {missing_in_demo}")
                if missing_in_geo:
                    print(f"States in states_zones_parties_tribes.csv but missing in GeoJSON: {missing_in_geo}")
                # Merge political/tribal on normalized key
                gdf = gdf.merge(states_demo, left_on='shapeName_norm', right_on='state_norm', how='left')
                merged_count = gdf['Zone'].notna().sum() if 'Zone' in gdf.columns else 0
                print(f"Merged political/tribal for {merged_count} states")
            
            if demo_stats is None:
                print("No extended state_demographics to merge")
            else:
                # Normalize and join on the same normalized key
                if 'State' in demo_stats.columns and 'state' not in demo_stats.columns:
                    demo_stats = demo_stats.rename(columns={'State': 'state'})
                demo_stats['state_norm'] = self.normalize_state_series(demo_stats['state'])
                if 'shapeName_norm' not in gdf.columns:
                    gdf['shapeName_norm'] = self.normalize_state_series(gdf['shapeName'])
                gdf = gdf.merge(demo_stats, left_on='shapeName_norm', right_on='state_norm', how='left')
                merged_demo = gdf['registered_voters'].notna().sum() if 'registered_voters' in gdf.columns else 0
                print(f"Merged state_demographics for {merged_demo} states")

            # Cleanup helper columns
            gdf = gdf.drop(columns=[c for c in ['shapeName_norm', 'state_norm'] if c in gdf.columns], errors='ignore')
            return gdf
            
        except Exception as e:
            print(f"Error merging demographic data: {str(e)}")
            return gdf
    
    def process_data(self):
        """Process the raw data sources and create integrated dataset"""
        try:
            print("Processing data...")
            
            # Load the GeoJSON data (prefer processed)
            src = self.processed_geojson_file if os.path.exists(self.processed_geojson_file) else self.raw_geojson_file
            gdf = gpd.read_file(src)
            
            # Ensure we have the required columns
            if 'shapeName' not in gdf.columns:
                # Try to find alternative column names
                name_columns = [col for col in gdf.columns if 'name' in col.lower() or 'state' in col.lower()]
                if name_columns:
                    gdf['shapeName'] = gdf[name_columns[0]]
                else:
                    gdf['shapeName'] = gdf.index.astype(str)
            
            # Ensure area_km2 present; if not, compute
            if 'area_km2' not in gdf.columns or gdf['area_km2'].isna().all():
                print("area_km2 missing; calculating from geometry...")
                try:
                    gdf = gdf.to_crs(3395)
                    gdf['area_km2'] = gdf.geometry.area / 1_000_000
                except Exception:
                    gdf['area_km2'] = gdf.geometry.area / 1_000_000
            
            # Load and merge enrichment data
            states_demo, demo_stats, tribes_data = self.load_demographic_data()
            gdf = self.merge_demographic_data(gdf, states_demo, demo_stats)
            
            # Create metadata file
            self.create_metadata(gdf, tribes_data)
            # Emit derived JSONs for frontend speed
            self.write_derived_jsons(gdf, tribes_data)
            
            # Save processed data
            # Standardize FCT naming in outputs
            if 'shapeName' in gdf.columns:
                gdf['shapeName'] = gdf['shapeName'].astype(str).str.replace(
                    r"\bAbuja\s*Federal\s*Capital\s*Territory\b|\bFederal\s*Capital\s*Territory\b|\bFCT\b|\bFCT\.?\s*Abuja\b",
                    "Abuja",
                    regex=True,
                )

            gdf.to_file(self.processed_file, driver='GeoJSON')
            print(f"Processed data saved to {self.processed_file}")
            
            return True
            
        except Exception as e:
            print(f"Error processing data: {str(e)}")
            return False

    def write_derived_jsons(self, gdf, tribes_data):
        """Write small derived JSONs used by the frontend (optional)."""
        try:
            out_dir = os.path.join(self.processed_dir, 'derived')
            os.makedirs(out_dir, exist_ok=True)

            # Zone stats: state count and total area
            if 'Zone' in gdf.columns:
                zone_stats = (
                    gdf[['Zone', 'area_km2']]
                    .groupby('Zone', dropna=False)
                    .agg(stateCount=('Zone', 'count'), totalArea=('area_km2', 'sum'))
                    .reset_index()
                    .to_dict(orient='records')
                )
            else:
                zone_stats = []
            with open(os.path.join(out_dir, 'zone_stats.json'), 'w') as f:
                json.dump(zone_stats, f)

            # Party stats: count by Typical_Parties (split by comma)
            party_counts = {}
            if 'Typical_Parties' in gdf.columns:
                for p in gdf['Typical_Parties'].fillna(''):
                    for token in [t.strip() for t in str(p).split(',') if t.strip()]:
                        party_counts[token] = party_counts.get(token, 0) + 1
            party_stats = [{ 'party': k, 'stateCount': v } for k, v in sorted(party_counts.items(), key=lambda x: -x[1])]
            with open(os.path.join(out_dir, 'party_stats.json'), 'w') as f:
                json.dump(party_stats, f)

            # Tribe stats: write-through of national-level CSV if available
            if tribes_data is not None:
                tribe_stats = tribes_data.to_dict(orient='records')
                with open(os.path.join(out_dir, 'tribe_stats.json'), 'w') as f:
                    json.dump(tribe_stats, f)

            # Demographics summary: totals and per-state subset (include political_affiliation when available)
            fields = ['total_population', 'voting_age_population', 'registered_voters']
            demo = {}
            if all(f in gdf.columns for f in fields):
                demo['totals'] = {f: int(gdf[f].fillna(0).sum()) for f in fields}
                demo['states'] = [
                    {
                        'state': str(row.get('shapeName') or row.get('State')).replace('Abuja Federal Capital Territory', 'Abuja').replace('Federal Capital Territory', 'Abuja'),
                        'total_population': int(row.get('total_population') or 0),
                        'registered_voters': int(row.get('registered_voters') or 0),
                        'voting_age_population': int(row.get('voting_age_population') or 0),
                        'political_affiliation': (row.get('political_affiliation') if pd.notna(row.get('political_affiliation')) else None),
                    }
                    for _, row in gdf.iterrows()
                ]
            with open(os.path.join(out_dir, 'demographics.json'), 'w') as f:
                json.dump(demo, f)

            print(f"Derived JSONs written to {out_dir}")
        except Exception as e:
            print(f"Error writing derived JSONs: {e}")

    def upsert_demographics_table(self):
        """Replace state_demographics table from derived/demographics.json if DB is configured."""
        try:
            from db.connect import engine  # lazy import
        except Exception as e:
            print(f"Skipping DB upsert (no DB config): {e}")
            return
        try:
            path = os.path.join(self.processed_dir, 'derived', 'demographics.json')
            if not os.path.exists(path):
                print("No derived demographics.json to upsert")
                return
            with open(path, 'r') as f:
                payload = json.load(f)
            rows = payload.get('states') or []
            if not rows:
                print("demographics.json has no states; skip upsert")
                return
            import pandas as pd
            df = pd.DataFrame(rows)
            # Ensure expected columns exist
            for col in ['state', 'total_population', 'voting_age_population', 'registered_voters', 'political_affiliation']:
                if col not in df.columns:
                    df[col] = None
            df = df[['state', 'total_population', 'voting_age_population', 'registered_voters', 'political_affiliation']]
            with engine.begin() as conn:
                # Ensure political_affiliation column exists
                try:
                    conn.exec_driver_sql("ALTER TABLE state_demographics ADD COLUMN IF NOT EXISTS political_affiliation VARCHAR(100)")
                except Exception:
                    pass
                conn.exec_driver_sql("TRUNCATE TABLE state_demographics")
            df.to_sql('state_demographics', engine, if_exists='append', index=False)
            print(f"Upserted state_demographics: {len(df)} rows")
        except Exception as e:
            print(f"Error upserting demographics: {e}")
    
    def create_metadata(self, gdf, tribes_data):
        """Create metadata file with data source information"""
        try:
            metadata = {
                "data_sources": {
                    "geojson_source": "geoBoundaries.org - Nigeria ADM1 boundaries",
                    "area_data_source": "nigeria_states_data.csv - Official state areas",
                    "demographic_source": "states_zones_parties_tribes.csv - Political and tribal data",
                    "tribal_source": "tribes.csv - Population statistics"
                },
                "processing_info": {
                    "total_states": int(len(gdf)),
                    "states_with_demographic_data": int(gdf['Zone'].notna().sum() if 'Zone' in gdf.columns else 0),
                    "total_ethnic_groups": int(len(tribes_data) if tribes_data is not None else 0),
                    "area_data_source": "CSV" if os.path.exists(self.raw_area_file) else "Geometric calculation"
                },
                "data_quality": {
                    "missing_zones": int(gdf['Zone'].isna().sum() if 'Zone' in gdf.columns else len(gdf)),
                    "missing_areas": int(gdf['area_km2'].isna().sum() if 'area_km2' in gdf.columns else len(gdf))
                }
            }
            
            metadata_file = os.path.join(self.metadata_dir, 'data_sources.json')
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            
            print(f"Metadata saved to {metadata_file}")
            
        except Exception as e:
            print(f"Error creating metadata: {str(e)}")
    
    def run_pipeline(self):
        """Run the complete ETL pipeline"""
        print("Starting ETL pipeline...")
        # Process using processed sources; fetch only if nothing exists
        self.fetch_data()
        if not self.process_data():
            return False
        # Upsert DB with demographics
        self.upsert_demographics_table()
        
        print("ETL pipeline completed successfully!")
        return True

def main():
    """Main function to run the ETL pipeline"""
    etl = NigeriaDataETL()
    success = etl.run_pipeline()
    
    if success:
        print("ETL pipeline completed successfully!")
    else:
        print("ETL pipeline failed!")

if __name__ == "__main__":
    main()