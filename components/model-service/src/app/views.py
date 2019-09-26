from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
import request
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    content = request.get_json(silent=True)
    return content


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
