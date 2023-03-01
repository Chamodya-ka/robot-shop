import os
import random
import string
from locust import HttpUser, task, between, SequentialTaskSet
from random import choice
from random import randint
import time


def generate_random_string(length):
    
    letters_l = string.ascii_lowercase
    letters_u = string.ascii_uppercase
    digits = string.digits
    if length < 3 :
        return ''.join(random.choice(letters_l) for i in range(length))
    random_str = ''
    random_str = random_str.join(random.choice(letters_l) for i in range(length//3))
    random_str = random_str.join(random.choice(letters_u) for i in range(length//3))
    random_str = random_str.join(random.choice(digits) for i in range(length//3 + length%3))

    return random_str



class UserBehavior(HttpUser):    
    fake_ip_addresses = [
            # white house
            "156.33.241.5",
            # Hollywood
            "34.196.93.245",
            # Chicago
            "98.142.103.241",
            # Los Angeles
            "192.241.230.151",
            # Berlin
            "46.114.35.116",
            # Singapore
            "52.77.99.130",
            # Sydney
            "60.242.161.215"
        ]
    def on_start(self):
        """ on_start is called when a Locust start before any task is scheduled """
        print('Starting')

    
    
    @task(10)
    class SequenceOfTasks(SequentialTaskSet):
        # source: https://tools.tracemyip.org/search--ip/list
        fake_ip_addresses = [
            # white house
            "156.33.241.5",
            # Hollywood
            "34.196.93.245",
            # Chicago
            "98.142.103.241",
            # Los Angeles
            "192.241.230.151",
            # Berlin
            "46.114.35.116",
            # Singapore
            "52.77.99.130",
            # Sydney
            "60.242.161.215"
        ]
        u_name = "username"
        p_word = "admin"
        wait_time = between(20, 40)
        @task(1)
        def register(self):
            len_cred = random.randrange(5,15+1)
            u_name = generate_random_string(len_cred)
            #Debugging
            #file = open('log.txt', 'a+')
            #file.write('user:name {}'.format(u_name))
            #file.close()
            p_word = generate_random_string(len_cred)
            e_mail = generate_random_string(len_cred)
            fake_ip = random.choice(self.fake_ip_addresses)

            # error case username already in use
            if randint(1, 10) <= 1:
                u_name = 'user'
                p_word = 'password'
            
            credentials = {
                'name': u_name,
                'password': p_word,
                'email': e_mail
            }

            


            res = self.client.post('/api/user/register', json=credentials, headers={'x-forwarded-for': fake_ip})
            print('register {}'.format(res.status_code))
            
            file = open('credentials.txt','a+')
            file.write(u_name+':'+p_word+"\n")
            file.close()
            #Debugging
            #file.close()
            #file = open('log.txt','a+')
            #file.write('register {} \n'.format(res.status_code))
            #file.close()

        @task(1)
        def login(self):
            fake_ip = random.choice(self.fake_ip_addresses)
            #u_name,p_word = "user", "password"
            credentials = {
                        'name': self.u_name,
                        'password': self.p_word
                        }
            
            file = open('credentials.txt','r')  
            credentials = file.readlines()
            file.close()
            if (len(credentials)!=0):
                u_name,p_word = random.choice(credentials).split(":")
                u_name = u_name.strip()
                p_word = p_word.strip('\n')

                self.u_name = u_name
                self.p_word = p_word
                #file = open('log.txt','a+')
                #file.write(self.u_name + ":"+ self.p_word+"\n")
                #file.close()
                 # error case wrong user name and password
                if randint(1, 10) <= 1:
                    u_name = ''
                    p_word = ''
                credentials = {
                        'name': u_name,
                        'password': p_word
                        }
           

            res = self.client.post('/api/user/login', json=credentials, headers={'x-forwarded-for': fake_ip})
            #print('login {}'.format(res.status_code))
            #user = self.client.get('/api/user/uniqueid', headers={'x-forwarded-for': fake_ip}).json()
            #uniqueid = user['uuid']
            
        

        @task(1)
        def load(self):
            fake_ip = random.choice(self.fake_ip_addresses)
            self.client.get('/', headers={'x-forwarded-for': fake_ip})
            user = self.client.get('/api/user/uniqueid', headers={'x-forwarded-for': fake_ip}).json()
            uniqueid = self.u_name
            """ print('User {}'.format(uniqueid))
            res = self.client.get('/api/user/history/{}'.format(uniqueid),headers={'x-forwarded-for': fake_ip})
            
            file = open('log.txt','a+')
            file.write('history {} \n'.format(res.status_code))
            file.close() """

            self.client.get('/api/catalogue/categories', headers={'x-forwarded-for': fake_ip})
            # all products in catalogue
            products = self.client.get('/api/catalogue/products', headers={'x-forwarded-for': fake_ip}).json()
            for i in range(2):
                item = None
                while True:
                    item = choice(products)
                    if item['instock'] != 0:
                        break

                # vote for item
                if randint(1, 10) <= 3:
                    self.client.put('/api/ratings/api/rate/{}/{}'.format(item['sku'], randint(1, 5)), headers={'x-forwarded-for': fake_ip})

                self.client.get('/api/catalogue/product/{}'.format(item['sku']), headers={'x-forwarded-for': fake_ip})
                self.client.get('/api/ratings/api/fetch/{}'.format(item['sku']), headers={'x-forwarded-for': fake_ip})
                self.client.get('/api/cart/add/{}/{}/1'.format(uniqueid, item['sku']), headers={'x-forwarded-for': fake_ip})

            cart = self.client.get('/api/cart/cart/{}'.format(uniqueid), headers={'x-forwarded-for': fake_ip}).json()
            item = choice(cart['items'])
            if randint(1, 10) <= 7:
                # random cart updates
                self.client.get('/api/cart/update/{}/{}/2'.format(uniqueid, item['sku']), headers={'x-forwarded-for': fake_ip})
            # country codes
            code = choice(self.client.get('/api/shipping/codes', headers={'x-forwarded-for': fake_ip}).json())
            city = choice(self.client.get('/api/shipping/cities/{}'.format(code['code']), headers={'x-forwarded-for': fake_ip}).json())
            print('code {} city {}'.format(code, city))
            shipping = self.client.get('/api/shipping/calc/{}'.format(city['uuid']), headers={'x-forwarded-for': fake_ip}).json()
            shipping['location'] = '{} {}'.format(code['name'], city['name'])
            print('Shipping {}'.format(shipping))
            # POST
            if randint(1, 10) <= 8:
                # checked price and did not proceed
                cart = self.client.post('/api/shipping/confirm/{}'.format(uniqueid), json=shipping, headers={'x-forwarded-for': fake_ip}).json()
                print('Final cart {}'.format(cart))
                order = self.client.post('/api/payment/pay/{}'.format(uniqueid), json=cart, headers={'x-forwarded-for': fake_ip}).json()
                print('Order {}'.format(order))

        @task(1)
        def get_history(self):
            fake_ip = random.choice(self.fake_ip_addresses)
            self.client.get('/', headers={'x-forwarded-for': fake_ip})
            #user = self.client.get('/api/user/uniqueid', headers={'x-forwarded-for': fake_ip}).json()
            uniqueid = self.u_name
            print('User {}'.format(uniqueid))
            try:
                res = self.client.get('/api/user/history/{}'.format(uniqueid),headers={'x-forwarded-for': fake_ip}).json()  
            except:
                pass
                
            #Debugging
            #file = open('log.txt','a+')
            #file.write('history {} \n'.format(res.status_code))
            #file.close()
    @task
    def error(self):
        fake_ip = random.choice(self.fake_ip_addresses)
        if os.environ.get('ERROR') == '1':
            print('Error request')
            cart = {'total': 0, 'tax': 0}
            self.client.post('/api/payment/pay/partner-57', json=cart, headers={'x-forwarded-for': fake_ip})


