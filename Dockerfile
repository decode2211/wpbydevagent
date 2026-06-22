# =====================================================================
# Stage 1: Build the React single-page application frontend
# =====================================================================
FROM node:20-slim AS frontend-build
WORKDIR /frontend

# Copy dependencies manifest
COPY frontend/package*.json ./
RUN npm ci

# Copy codebase and compile assets
COPY frontend/ ./
RUN npm run build

# =====================================================================
# Stage 2: Packages python runtime and compiles static pages
# =====================================================================
FROM python:3.11-slim
WORKDIR /app

# Configure environmental controls
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY backend/ .

# Inject static files from build container
COPY --from=frontend-build /frontend/dist ./static

# Expose ports and run server
EXPOSE 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
