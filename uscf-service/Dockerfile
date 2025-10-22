FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY uscf_lookup.py .
COPY uscf_service.py .

EXPOSE 8080

CMD ["python", "uscf_service.py"]
