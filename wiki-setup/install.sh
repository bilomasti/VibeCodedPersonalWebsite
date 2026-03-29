#!/bin/bash
# Wiki.js install script — run this in the Node.js app terminal in cPanel

echo "Downloading Wiki.js..."
curl -sSL https://github.com/requarks/wiki/releases/latest/download/wiki-js.tar.gz -o wiki-js.tar.gz

echo "Extracting..."
tar xzf wiki-js.tar.gz
rm wiki-js.tar.gz

echo "Copying config..."
cp config.sample.yml config.yml

echo "Done. Edit config.yml then start the app in cPanel."
