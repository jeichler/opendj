from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
from flask import request
from flask import jsonify, make_response
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    req = request.get_json(silent=True)
    print(req)
    res = make_response(jsonify(req), 200)
    return res


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
