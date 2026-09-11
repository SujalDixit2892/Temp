# FacilityOps

## Run locally

Start the API from the project root:

```bash
uvicorn backend.main:app --reload
```

In another terminal, serve the static frontend:

```bash
python3 -m http.server 5501
```

Open `http://127.0.0.1:5501/`. The root page redirects to the canonical frontend entry point at `frontend/pages/index.html`.

## Frontend layout

- `frontend/pages/` contains the dashboard pages.
- `frontend/assets/css/` contains shared styles.
- `frontend/assets/js/` contains page modules and API helpers.