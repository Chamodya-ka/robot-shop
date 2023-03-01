package com.instana.robotshop.shipping;

import java.util.List;
import java.util.Arrays;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import io.micrometer.core.instrument.MeterRegistry;



@RestController
public class Controller {

    
    @Autowired
    MeterRegistry meterRegistry;
    private static final Logger logger = LoggerFactory.getLogger(Controller.class);
    private String CART_URL = String.format("http://%s/shipping/", getenv("CART_ENDPOINT", "cart"));
    public static List bytesGlobal = Collections.synchronizedList(new ArrayList<byte[]>());

    @Autowired
    private CityRepository cityrepo;

    @Autowired
    private CodeRepository coderepo;

    private String getenv(String key, String def) {
        String val = System.getenv(key);
        val = val == null ? def : val;

        return val;
    }

    @GetMapping(path = "/memory")
    public int memory() {
        //long start = System.currentTimeMillis();
        byte[] bytes = new byte[1024 * 1024 * 25];
        Arrays.fill(bytes,(byte)8);
        bytesGlobal.add(bytes);
        //long finish = System.currentTimeMillis();
        //long timeElapsed = finish - start;
        //meterRegistry.timer("shipping_get_memory_rt").record(Duration.ofMillis(timeElapsed));
        return bytesGlobal.size();
    }

    @GetMapping(path = "/free")
    public int free() {
        //long start = System.currentTimeMillis();
        bytesGlobal.clear();
        //long finish = System.currentTimeMillis();
        //long timeElapsed = finish - start;
        //meterRegistry.timer("shipping_get_free_rt").record(Duration.ofMillis(timeElapsed));
        return bytesGlobal.size();
    }

    @GetMapping("/health")
    public String health() {
        return "OK";
    }

    @GetMapping("/count")
    public String count() {
        // Histogram.Timer requestTimer = requestLatency.startTimer();
        long start = System.currentTimeMillis();
        long count = cityrepo.count();
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_shipping_get_count").record(Duration.ofMillis(timeElapsed));
        //get_resp_shipping_count.observe(timeElapsed);
        // requestTimer.observeDuration(); 
        return String.valueOf(count);
    }

    @GetMapping("/codes")
    public Iterable<Code> codes() {
        long start = System.currentTimeMillis();
        logger.info("all codes");
        Iterable<Code> codes = coderepo.findAll(Sort.by(Sort.Direction.ASC, "name"));
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_web_get_shipping_code").record(Duration.ofMillis(timeElapsed));
        return codes;
    }

    @GetMapping("/cities/{code}")
    public List<City> cities(@PathVariable String code) {
        long start = System.currentTimeMillis();
        logger.info("cities by code {}", code);
        List<City> cities = cityrepo.findByCode(code);
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_shipping_get_citiescode").record(Duration.ofMillis(timeElapsed));
        return cities;
    }

    @GetMapping("/match/{code}/{text}")
    public List<City> match(@PathVariable String code, @PathVariable String text) {
        long start = System.currentTimeMillis();
        logger.info("match code {} text {}", code, text);

        if (text.length() < 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }

        List<City> cities = cityrepo.match(code, text);
        /*
         * This is a dirty hack to limit the result size
         * I'm sure there is a more spring boot way to do this
         * TODO - neater
         */
        if (cities.size() > 10) {
            cities = cities.subList(0, 9);
        }
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_web_get_shipping_matchcode").record(Duration.ofMillis(timeElapsed));
        return cities;
    }

    @GetMapping("/calc/{id}")
    public Ship caclc(@PathVariable long id) {
        long start = System.currentTimeMillis();
        // intrument this
        double homeLatitude = 51.164896;
        double homeLongitude = 7.068792;

        logger.info("Calculation for {}", id);

        City city = cityrepo.findById(id);
        if (city == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "city not found");
        }

        Calculator calc = new Calculator(city);
        long distance = calc.getDistance(homeLatitude, homeLongitude);
        // avoid rounding
        double cost = Math.rint(distance * 5) / 100.0;
        Ship ship = new Ship(distance, cost);
        logger.info("shipping {}", ship);
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_web_get_shipping_calcid").record(Duration.ofMillis(timeElapsed));

        return ship;
    }

    /* @GetMapping("/metrics")
    public Histogram metrics() {
        return get_resp_shipping_count;
    } */


    // enforce content type
    @PostMapping(path = "/confirm/{id}", consumes = "application/json", produces = "application/json")
    public String confirm(@PathVariable String id, @RequestBody String body) {
        long start = System.currentTimeMillis();
        logger.info("confirm id: {}", id);
        logger.info("body {}", body);

        CartHelper helper = new CartHelper(CART_URL);
        String cart = helper.addToCart(id, body);

        if (cart.equals("")) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "cart not found");
        }
        long finish = System.currentTimeMillis();
        long timeElapsed = finish - start;
        meterRegistry.timer("rt_web_get_shipping_postconfirm").record(Duration.ofMillis(timeElapsed));
        return cart;
    }
}
