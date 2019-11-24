# Retrieve current map:
#curl -O http://everynoise.com/engenremap.html

# Create JSON from HTML the hard and ugly way:
perl -ne 'print "{\"width\": $1, \"height\": $2,\n" if /<div class=canvas style="width: (\d*)px; height: (\d*)px/' engenremap.html 
echo "  \"genres\": {"
perl -ne 'print "    \"$5\":{\"id\":$1, \"y\":$2, \"x\":$3, \"w\":$4},\n" if /<div id=item(\d*).* top: (\d*)px; left: (\d*)px; font-size: (\d*)%.*>(.*)<a class/' engenremap.html 
echo "  }"
echo "}"


