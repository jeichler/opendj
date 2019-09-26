from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
from flask import request
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    req = request.get_json(silent=True)
    print(req)
    return req


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
