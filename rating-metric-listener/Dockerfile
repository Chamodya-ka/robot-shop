FROM python:3.9

EXPOSE 8082
USER root

ENV INSTANA_SERVICE_NAME=rating-metric-listener

WORKDIR /app

COPY requirements.txt /app/

RUN pip install -r requirements.txt

COPY *.py /app/
COPY rating-listener.ini /app/

CMD ["uwsgi", "--ini", "rating-listener.ini"]

