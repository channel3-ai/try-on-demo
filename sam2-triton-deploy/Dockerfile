FROM nvcr.io/nvidia/tritonserver:24.10-py3

# Install system deps and Python packages for SAM2
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    python3-pip \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# Allow switching between CUDA and CPU PyTorch wheels
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cu121

# Install PyTorch and common deps
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir pillow numpy PyYAML requests \
    && pip install --no-cache-dir torch torchvision torchaudio --index-url ${TORCH_INDEX_URL}

# Install SAM2 v2.1 and expose on PYTHONPATH so Hydra can resolve configs
ARG SAM2_REF=sam2.1
RUN git clone --depth=1 --branch ${SAM2_REF} https://github.com/facebookresearch/sam2.git /opt/sam2 \
    && pip install --no-cache-dir -e /opt/sam2
ENV PYTHONPATH=/opt/sam2:${PYTHONPATH}

# Create default weights directory; user should mount or copy checkpoints here
RUN mkdir -p /models/sam2/weights

# Default command is set by run script; this image just adds deps.