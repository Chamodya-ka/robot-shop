#!/bin/sh

# set -x

if [ -z "$HOST" ]
then
    echo "HOST env not set"
    exit 1
fi

if echo "$NUM_CLIENTS" | egrep -q '^[0-9]+$'
then
    if [ $NUM_CLIENTS -eq 0 ]
    then
        NUM_CLIENTS=1
    fi
    echo "Starting load with $NUM_CLIENTS clients"
else
    echo "NUM_CLIENTS $NUM_CLIENTS is not a number"
    exit 1
fi


if [ "$RUN_TIME" != "0" ]
then
    if echo "$RUN_TIME" | egrep -q '^([0-9]+h)?([0-9]+m)?$'
    then
        TIME="-t $RUN_TIME"
    else
        echo "Wrong time format, use 2h42m"
        exit 1
    fi
else
    unset RUN_TIME
    unset TIME
fi

echo "Starting $CLIENTS clients for ${RUN_TIME:-ever}"
# if [ "$SILENT" -eq 1 ]
# then
#     locust -f robot-shop.py --host "$HOST" --headless -r 1 -u $NUM_CLIENTS $TIME > /dev/null 2>&1
# else
#     locust -f robot-shop.py --host "$HOST" --headless -r 1 -u $NUM_CLIENTS $TIME
# fi

# period min-max users
# 0-2     75-200
# 2-6     75-150
# 6-12    150-400
# 12-17   250-550
# 17-22   400-750
# 22-0    200-450
while true; do
  current_hour=$(date +%H)


  echo "Start $NUM_CLIENTS at $current_hour"
  locust -f robot-shop.py --host "$HOST" --headless -r 0.1 -u 90 -t 23m -s 5s &
  locust -f robot-shop.py --host "$HOST" --headless -r 2 -u 50 -t 11m -s 5s &
  locust -f robot-shop.py --host "$HOST" --headless -r 0.05 -u 60 -t 19m -s 5s

done