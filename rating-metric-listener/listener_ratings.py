#import random
#import instana
#import os
#import sys
#import time
import logging
#import uuid
import json
#import requests
#import traceback
from flask import Flask
from flask import Response
from flask import request
from flask import jsonify
#from rabbitmq import Publisher
# Prometheus
import prometheus_client
from prometheus_client import Counter, Histogram

app = Flask(__name__)
app.logger.setLevel(logging.INFO)
# Prometheus
PromMetrics = {}
PromMetrics['rt_ratings_get_catalogue'] = Histogram('rt_ratings_get_catalogue', 'Ratings get Catalogue response time', buckets=(0,10,50,100,200,500,1000,5000,10000))
PromMetrics['rt_ratings_put_PDO'] = Histogram('rt_ratings_put_PDO', 'Ratings update PDO response time', buckets=(0,10,50,100,200,500,1000,5000,10000))
PromMetrics['rt_web_get_ratings'] = Histogram('rt_web_get_ratings', 'Web get Ratings response time', buckets=(0,10,50,100,200,500,1000,5000,10000))
print("listener starting")
print("listener starting")
print("listener starting")
print("listener starting")
# Prometheus
@app.route('/ratings/metrics', methods=['GET'])
def metrics():
    res = []
    for m in PromMetrics.values():
        res.append(prometheus_client.generate_latest(m))

    return Response(res, mimetype='text/plain')

@app.route('/put/metrics', methods=['POST'])
def rat_service_rt():
    data = request.get_json()
    y =  data ['metrics']
    PromMetrics['rt_ratings_get_catalogue'].observe(float(y['rt_ratings_get_catalogue']))
    PromMetrics['rt_ratings_put_PDO'].observe(float(y['rt_ratings_put_PDO']))
    return json.dumps({'success': True}), 200, {'ContentType':'application/json'}

@app.route('/get/metrics', methods=['POST'])
def cat_service_rt():
    data = request.get_json()
    y =  data ['metrics']
    PromMetrics['rt_web_get_ratings'].observe(float(y["rt_web_get_ratings"]))
    return json.dumps({'success': True}), 200, {'ContentType':'application/json'}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8082)