import pandas
import numpy
import pickle
from sklearn.preprocessing import StandardScaler,MinMaxScaler
from sklearn.cluster import DBSCAN
import os
import csv
import sys
import json
import random

random.seed = 123

prefix_genresimple = 'genresimple'

model_filename = None
genresimple_filename = None
loaded_model = None
genresimple_onehot = None

def predict(newTrack):
    ''' Predict a clsuter id for a given track. Pass track as dict. '''

    global model_filename
    global genresimple_filename
    global loaded_model
    global genresimple_onehot

    if model_filename is None:
        model_filename = os.environ['MODEL_PATH']
        loaded_model = pickle.load(open(model_filename, 'rb'))

    if genresimple_filename is None:
        genresimple_filename = os.environ['GENRESIMPLE_PATH']

        genresimple_onehot = []

        with open(genresimple_filename) as f:
            lines = f.readlines()

            for line in lines:
                genresimple_onehot.append(line[:-1])

    cluster_id = -1

    print("\n")
    print(genresimple_onehot)

    track_genresimple_onehot = dict(zip(genresimple_onehot, [0] * len(list(genresimple_onehot))))
    track_genresimple_onehot[prefix_genresimple + '_' + newTrack['genreSimple']] = 1

    y = newTrack['year']

    t = [newTrack['danceability'] > 50, ((y - 1900) - (y - 1900) % 10) / 100]
    t.extend(list(track_genresimple_onehot.values()))

    print(t)

    cluster_id = loaded_model.predict([t])[0]

    return cluster_id


def putTrackIntoList(newTrack, currentList):

    # First, identify the cluster of the track.
    predictedCluster = predict(newTrack)
    newTrack["cluster_id"] = predictedCluster

    # Now decide where to put it in the list.
    if len(currentList) == 0:
        return 0

    else:

        clusterExists = False

        # Search for the predicted cluster in the current list
        for i in range(len(currentList)):
            if currentList[i]["cluster_id"] == int(predictedCluster):
                clusterExists = True

                while currentList[i]["cluster_id"] == predictedCluster and i < len(currentList):
                    i += 1

                return i

        existingClusters = {}

        for i in range(len(currentList)):
            if currentList[i]["cluster_id"] not in existingClusters.keys():
                existingClusters[currentList[i]["cluster_id"]] = i

        if(len(existingClusters.keys())) == 1:
            return len(currentList)
        else:

            # Exclude the first value, because we don't want to put the track at the beginning of the list
            position_index = random.randint(1, len(existingClusters.values()) - 1)
            return list(existingClusters.values())[position_index]
