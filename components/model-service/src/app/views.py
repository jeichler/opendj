from flask import render_template, flash, redirect
from app import app
import urllib
import jsonify
import json
import random
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

    print ("name : "+str(name)+" genreSimpleNum : "+str(genreSimpleNum)+" danceability : "+str(danceability)+" year : "+str(year))

    res = req

    listlen = len(req['currentList'])
    newposition = random.randrange(0, listlen)
    res["position"] = newposition

    res = make_response(jsonify(res), 200)
    return res


@app.route('/health', methods=['GET'])
def health():
  return 'OK'
