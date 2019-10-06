class Track:

    def __init__(self, genre, danceability, year, cluster):
        self.isValid = isValid
        self.classification = classification
        self.url = url
        self.prob = prob

    def toString(self):
        print ("url : "+self.url+" category : "+self.classification+" prob : "+self.prob)

class BotError:
    def __init__(self, error, message):
        self.error = error
        self.message = message;
