#!/bin/bash
#magick -background '#00000000' Logo_OnlyCover.png -rotate -45 Logo_OnlyDisc.png -rotate 45  -gravity center -composite out.png
#magick out.png -crop 1024x1024+0+0 out2.png

#for i in {0..359}
#do
#  j=$(printf "%03d" $i)
#  echo "Rotate $j"
#  magick -background '#00000000' ../Logo_OnlyCover.png -rotate -$i ../Logo_OnlyDisc.png -rotate $i  -gravity center -composite  -gravity None -crop 1024x1024+0+0  Logo_$j.png
#done


#magick -delay 100 -loop 0 -dispose none Logo_*.png -scale 256x256 anim.gif
#ffmpeg -i Logo_OpenDJ_Anim_512.gif -b:v 0 -crf 25 Logo_OpenDJ_Anim_512.mp4

# Apple:
#ffmpeg -i Logo_OpenDJ_Anim_512.gif -b:v 0 -crf 25 -f mp4 -vcodec libx264 -pix_fmt yuv420p Logo_OpenDJ_Anim_512.mp4
#ffmpeg -i Logo_OpenDJ_Anim_512.gif -c vp9 -b:v 0 -crf 41 Logo_OpenDJ_Anim_512.webm
for i in 64 128 256 512 1024
do
  echo "Encode $i"
  ffmpeg -framerate 10 -i logo/Logo_%03d.png -vf scale=$i:-1 -c vp9 -b:v 0 -crf 41 Logo_OpenDJ_Anim_${i}_crf41.webm
done
