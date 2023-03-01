FROM golang:1.17

WORKDIR /go/src/app
EXPOSE 8080
COPY *.go .

RUN go mod init dispatch && go get
RUN go install

CMD dispatch
