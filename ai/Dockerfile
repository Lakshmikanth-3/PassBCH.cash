# Test runner for agent solutions. Runs with --network none; only pytest inside.
FROM python:3.12-slim
RUN pip install --no-cache-dir pytest==8.3.4 && useradd -m runner
USER runner
WORKDIR /work
ENTRYPOINT ["python", "-m", "pytest", "-q", "-p", "no:cacheprovider", "--tb=short"]
