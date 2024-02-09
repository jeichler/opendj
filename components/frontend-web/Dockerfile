FROM centos/httpd-24-centos7@sha256:001ec5d1b463d8d62c87b11ef9ca64603e6dd2eb88edadcb4f70f1c593aa83af

# copy artifact build from the 'build environment'
#COPY ./www/ /usr/local/apache2/htdocs/

COPY ./www/ /var/www/html/
COPY ./my-httpd.conf /etc/httpd/conf/httpd.conf

