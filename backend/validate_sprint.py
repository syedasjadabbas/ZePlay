import os
import sys
import time
import requests

def download_test_video():
    url = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" # ~158MB
    filename = "test_video.mp4"
    if not os.path.exists(filename):
        print("Downloading test video...")
        r = requests.get(url, stream=True)
        with open(filename, 'wb') as f:
            for chunk in r.iter_content(chunk_size=1024*1024):
                if chunk:
                    f.write(chunk)
        print("Downloaded.")
    return filename

def test_upload_and_processing():
    filename = "mov_bbb.mp4"
    filesize = os.path.getsize(filename)
    print(f"Test video size: {filesize / (1024*1024):.2f} MB")

    # Login to get token
    session = requests.Session()
    login_data = {"username": "admin@zeplay.com", "password": "Password123!"}
    
    # Or just use the testclient to avoid auth? No, we have real server on 8000.
    # Let's try to login
    print("Logging in...")
    r = session.post("http://localhost:8000/api/auth/login", data=login_data)
    if r.status_code != 200:
        print("Login failed, trying to create admin or maybe password is 'admin123'?")
        login_data["password"] = "admin123"
        r = session.post("http://localhost:8000/api/auth/login", data=login_data)
        if r.status_code != 200:
            print("Auth failed. Status:", r.status_code)
            print(r.text)
            return
            
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    print("Uploading video...")
    start_time = time.time()
    
    with open(filename, 'rb') as f:
        # We need multipart/form-data
        files = {'file': (filename, f, 'video/mp4')}
        resp = session.post("http://localhost:8000/api/videos/admin/upload", files=files, headers=headers)
        
    upload_end = time.time()
    
    if resp.status_code != 201:
        print("Upload failed:", resp.status_code, resp.text)
        return
        
    video = resp.json()
    video_id = video["video_id"]
    print(f"Upload completed in {upload_end - start_time:.2f}s. Video ID: {video_id}")
    print(f"Initial Status: {video['status']}")
    print(f"Initial Progress: {video.get('processing_progress', 0.0)}%")
    
    # Polling
    print("Polling processing progress...")
    poll_count = 0
    while True:
        poll_start = time.time()
        v_resp = session.get("http://localhost:8000/api/videos", headers=headers)
        poll_time = time.time() - poll_start
        
        videos = v_resp.json()
        v = next((v for v in videos if v["video_id"] == video_id), None)
        if not v:
            print("Video not found in list!")
            break
            
        print(f"Status: {v['status']}, Progress: {v.get('processing_progress', 0.0)}% | API latency: {poll_time*1000:.1f}ms")
        
        if v['status'] == 'completed' or v['status'] == 'failed':
            print(f"Finished processing in {time.time() - upload_end:.2f}s with status {v['status']}")
            break
            
        time.sleep(2)
        poll_count += 1
        if poll_count > 100:
            print("Timeout waiting for processing")
            break

if __name__ == "__main__":
    test_upload_and_processing()
