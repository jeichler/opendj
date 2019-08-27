# Component to position new tracks in a playlist, based on Machine Learning


http://localhost:8081/api/provider-spotify/v1/internal/exportPlaylist?delay=0&id=37i9dQZF1DX8a1tdzq5tbM


37i9dQZF1DX8a1tdzq5tbM  Dance Classics - Club hits from the 90s and 00s
37i9dQZF1DX9EM98aZosoy  Partyhymnen 2019
37i9dQZF1DWVWiyE9VDkCO  Party Deluxe - 
37i9dQZF1DX4Y4RhrZqHhr  Beach Party
37i9dQZF1DXaXB8fQg7xif  Dany Party -
37i9dQZF1DX7F6T2n2fegs  Throwback Party
37i9dQZF1DX8FwnYE6PRvL  Rock Party
37i9dQZF1DX0IlCGIUGBsA  Ultimate Party Classics
37i9dQZF1DX1rVvRgjX59F  90s Rock Anthems
37i9dQZF1DX1spT6G94GFC  80s Rock Anthems
37i9dQZF1DWTJ7xPn4vNaz  All Out 70s
19PgP2QSGPcm6Ve8VhbtpG  80s Smash Hits
37i9dQZF1DWWzBc3TOlaAV  60s Rock Anthems
1R0T3Qg2tlXVTj32YRKsHL  Stefan Bergsteins Liste
439GRGyrRa8lcML6cuLtj0  Hits zum Mitsingen
0Dl1xDgujU3jfiQp93XQh8 Zoe Russian Rap



delay=0
listIDs="37i9dQZF1DX8a1tdzq5tbM 37i9dQZF1DX9EM98aZosoy 37i9dQZF1DWVWiyE9VDkCO 37i9dQZF1DX4Y4RhrZqHhr 37i9dQZF1DXaXB8fQg7xif 37i9dQZF1DX7F6T2n2fegs 37i9dQZF1DX8FwnYE6PRvL 37i9dQZF1DX0IlCGIUGBsA 37i9dQZF1DX1rVvRgjX59F 37i9dQZF1DX1spT6G94GFC 37i9dQZF1DWTJ7xPn4vNaz 19PgP2QSGPcm6Ve8VhbtpG 37i9dQZF1DWWzBc3TOlaAV 1R0T3Qg2tlXVTj32YRKsHL 439GRGyrRa8lcML6cuLtj0 0Dl1xDgujU3jfiQp93XQh8" 
for list in $listIDs
do
    echo "Getting list $list"
    curl "http://localhost:8081/api/provider-spotify/v1/internal/exportPlaylist?delay=$delay&id=$list" >$list.json
done

