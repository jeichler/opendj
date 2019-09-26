from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    return jsonify(request.json)


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
