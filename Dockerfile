FROM php:8.2-apache

# Activare mod_rewrite și mod_headers pentru .htaccess
RUN a2enmod rewrite headers

# Permite .htaccess (AllowOverride All)
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# MIME type pentru ES modules (.mjs) — necesar pentru Big.js, JSZip
RUN echo 'AddType text/javascript .mjs' >> /etc/apache2/conf-available/mime-mjs.conf \
    && a2enconf mime-mjs

COPY . /var/www/html/

# Permisiuni pentru temp/ (receiver.php)
RUN mkdir -p /var/www/html/temp && chmod 777 /var/www/html/temp

EXPOSE 80
