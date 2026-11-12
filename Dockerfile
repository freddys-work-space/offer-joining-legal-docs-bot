# Production Dockerfile for Render Deployment using Debian Bookworm (active stable release)
FROM node:20-bookworm-slim

# Install LibreOffice Writer and essential fonts for DOCX to PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root letterhead templates
COPY APPLYUS_LETTERHEAD_offer_letter.docx ./
COPY APPLYUS_LETTERHEAD_joining_letter.docx ./
COPY APPLYUS_LETTERHEAD_legal_documents.docx ./

# Copy backend dependencies and install
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ ./

# Also copy templates into backend/templates/ as fallback
RUN mkdir -p /app/backend/templates && \
    cp /app/APPLYUS_LETTERHEAD_*.docx /app/backend/templates/

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
