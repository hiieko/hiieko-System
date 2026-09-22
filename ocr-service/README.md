# HIIEKO self-hosted OCR service

This service replaces Google Cloud Vision with PaddleOCR 3.x. It is an
authenticated processing service, not a second database or authorization
system. Supabase remains responsible for users, Storage, RLS, expenses, and
approval workflow.

## Run locally

```powershell
cd ocr-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:OCR_SERVICE_TOKEN="change-this-local-token"
uvicorn app.main:app --host 127.0.0.1 --port 8080
```

The first PaddleOCR request downloads its model. CPU inference is supported
but slower than a GPU.

On CPU-only Windows installations, PaddleX may select oneDNN by default. If
the runtime reports a oneDNN/PIR conversion error, start the service with:

```powershell
$env:PADDLE_PDX_ENABLE_MKLDNN_BYDEFAULT="False"
uvicorn app.main:app --host 127.0.0.1 --port 8080
```

The service applies this compatibility setting by default for its OCR
pipeline unless the environment has already selected a value.

## Docker

```powershell
docker build -t hiieko-ocr ocr-service
docker run --rm -p 8080:8080 -e OCR_SERVICE_TOKEN=change-this-local-token hiieko-ocr
```

Do not expose port 8080 publicly without TLS and authentication.
