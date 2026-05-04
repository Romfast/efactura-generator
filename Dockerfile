FROM php:8.2-apache

# Activare mod_rewrite și mod_headers pentru .htaccess
RUN a2enmod rewrite headers

# Permite .htaccess (AllowOverride All)
RUN sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# MIME type pentru ES modules (.mjs) — necesar pentru Big.js, JSZip
RUN echo 'AddType text/javascript .mjs' >> /etc/apache2/conf-available/mime-mjs.conf \
    && a2enconf mime-mjs

# Propagă variabilele ANAF_* către PHP (Apache curăță env-ul implicit).
RUN { \
      echo 'PassEnv ANAF_API_KEY ANAF_ALLOWED_IPS ANAF_TOKEN ANAF_TEMP_LIFETIME'; \
    } > /etc/apache2/conf-available/anaf-env.conf \
    && a2enconf anaf-env

COPY . /var/www/html/

# Permisiuni pentru temp/ (receiver.php)
RUN mkdir -p /var/www/html/temp && chmod 777 /var/www/html/temp

# Variabile de mediu pentru receiver.php (suprascriu config.json):
#   ANAF_API_KEY        — token X-Api-Key pentru upload XML (POST receiver.php)
#   ANAF_ALLOWED_IPS    — listă IP-uri separate prin virgulă; "*" = check dezactivat
#                         (recomandat în Dokploy/proxy: "*", same-origin protejează)
#   ANAF_TOKEN          — Bearer OAuth ANAF (opțional, neutilizat pentru validate/cif)
#   ANAF_TEMP_LIFETIME  — ore păstrare fișiere temp (default 1)
ENV ANAF_ALLOWED_IPS="*"

EXPOSE 80
