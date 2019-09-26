from flask import render_template, flash, redirect
from app import app
import urllib
from urllib.error import HTTPError

@app.route('/predict')
def index():
  return '7'

@app.route('/health')
def health():
  return 'OK'
