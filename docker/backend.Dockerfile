# syntax=docker/dockerfile:1
#
# Build context is backend/, Dockerfile lives outside it in docker/ (the
# build context governs what COPY can see; the Dockerfile's own location
# is independent of it):
#   docker build -f docker/backend.Dockerfile -t expense-tracker-backend backend
# (docker-compose.yml wires this up automatically -- see ../docker-compose.yml)

# ---- builder: install the app + its runtime dependencies into a venv ----
FROM python:3.11-slim AS builder

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY pyproject.toml ./
COPY app ./app
COPY scripts ./scripts

# `.[dev]` (ruff/black/pytest/httpx/...) is never installed here -- only
# [project.dependencies] from pyproject.toml, so none of that tooling ends
# up in the runtime image.
#
# --trusted-host is a workaround for this dev machine specifically: all
# outbound HTTPS from inside a container fails TLS verification here (some
# network-level interception -- confirmed via a raw TLS handshake test to
# pypi.org from a bare container, unrelated to pip/Python; VPN disconnect
# didn't fix it, no proxy configured in Docker Desktop or Windows). It does
# NOT fix the underlying issue, it just stops pip from verifying the
# certificate chain for these two hosts. Safe to delete this flag (and the
# matching one in frontend.Dockerfile) once that's actually resolved, or on
# any machine that doesn't have this problem in the first place.
RUN pip install --no-cache-dir \
    --trusted-host pypi.org \
    --trusted-host files.pythonhosted.org \
    .

# ---- runtime: no compiler, no pip cache, no dev tooling, non-root ----
FROM python:3.11-slim AS runtime

RUN useradd --create-home --uid 1000 appuser
WORKDIR /app

COPY --from=builder /opt/venv /opt/venv
# `app/` is also copied here even though `pip install .` in the builder
# stage already installed it into /opt/venv's site-packages -- a small,
# deliberate redundancy. scripts/seed_categories.py locates
# default_categories.json via a path relative to its own file location on
# disk (`Path(__file__).parent.parent / "app" / ...`), the same layout as
# local dev; keeping app/ and scripts/ as plain sibling directories here
# means that path resolution doesn't need special-casing for the
# packaged-vs-source-tree distinction. See learning/008 for the tradeoff.
COPY app ./app
COPY scripts ./scripts

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

USER appuser
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/health', timeout=2)" || exit 1

# Re-seeding is idempotent (category_service.seed_default_categories /
# payment_method_service.seed_default_payment_methods both skip names that
# already exist) -- running these on every container start, not just the
# first, means `docker compose up` always leaves a usable database with no
# separate manual seeding step, whether this is a fresh volume or not.
CMD ["sh", "-c", "python -m scripts.seed_categories && python -m scripts.seed_payment_methods && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
