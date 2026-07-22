import uuid
from locust import HttpUser, task, between

class ZePlayLoadTester(HttpUser):
    # Simulate user delay between tasks (1 to 3 seconds)
    wait_time = between(1, 3)

    def on_start(self):
        """Perform user setup (registration and login authentication)."""
        self.email = f"loaduser_{uuid.uuid4().hex[:8]}@example.com"
        self.password = "Password123!"
        self.token = None
        self.headers = {}
        
        # 1. Register User
        self.client.post(
            "/api/auth/register",
            json={"email": self.email, "name": "Load Test User", "password": self.password}
        )

        # 2. Login User
        login_resp = self.client.post(
            "/api/auth/login",
            data={"username": self.email, "password": self.password}
        )
        
        if login_resp.status_code == 200:
            self.token = login_resp.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}

    @task(3)
    def browse_catalog(self):
        """Simulate user browsing the home catalog list of movies."""
        self.client.get("/api/catalog/movies", headers=self.headers)

    @task(2)
    def search_movies(self):
        """Simulate user typing queries inside the search bar."""
        self.client.get("/api/catalog/search?q=Quantum", headers=self.headers)

    @task(4)
    def live_search_suggestions(self):
        """Simulate user auto-completing search suggestions (Trie-cached)."""
        self.client.get("/api/catalog/search/suggestions?q=cyb", headers=self.headers)

    @task(1)
    def get_user_profiles(self):
        """Simulate user loading the profiles selection page."""
        self.client.get("/api/profiles/", headers=self.headers)

    @task(2)
    def fetch_recommendations(self):
        """Simulate user requesting custom recommendations."""
        self.client.get("/api/recommendations/popular", headers=self.headers)
