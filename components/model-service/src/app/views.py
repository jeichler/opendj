from flask import render_template, flash, redirect
from app import app
import urllib
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def index():
  return '7'

@app.route('/health', methods=['GET'])
def health():
  return 'OK'
