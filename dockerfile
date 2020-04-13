FROM tensorflow/tensorflow:1.15.2-gpu-py3
WORKDIR /usr/src/app
COPY ./docker .
RUN apt-get install git -y
RUN pip install --no-cache-dir -r requirements.txt