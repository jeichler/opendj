from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
import json
from flask import request
from flask import jsonify, make_response
from urllib.error import HTTPError

@app.route('/predict', methods=['GET', 'POST'])
def predict():
    req = request.get_json(silent=True)
    print(req)

    name = req["newTrack"]["name"]
    genreSimpleNum = req["newTrack"]["genreSimpleNum"]
    danceability = req["newTrack"]["danceability"]
    year = req["newTrack"]["year"]

    print ("name : "+name+" genreSimpleNum : "+genreSimpleNum+" danceability : "+danceability+" year : "+year)

    currentList = name = req["currentList"]
    res = make_response(jsonify(currentList), 200)
    return res


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
