<?php

declare(strict_types=1);

namespace Instana\RobotShop\Ratings\Controller;

use Instana\RobotShop\Ratings\Service\CatalogueService;
use Instana\RobotShop\Ratings\Service\RatingsService;
use Psr\Log\LoggerAwareInterface;
use Psr\Log\LoggerAwareTrait;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/api")
 */
class RatingsApiController implements LoggerAwareInterface
{
    use LoggerAwareTrait;

    /**
     * @var RatingsService
     */
    private $ratingsService;

    /**
     * @var CatalogueService
     */
    private $catalogueService;
    //private rt_web_put_ratings_sum;
    //private rt_web_put_catalogue_sum;
    //private rt_web_get_ratings_sum;
    private $url_put;
    private $url_get;
    public function __construct(CatalogueService $catalogueService, RatingsService $ratingsService)
    {
        $this->ratingsService = $ratingsService;
        $this->catalogueService = $catalogueService;
        $this->url_put = "http://rating-metric-listener:8082/put/metrics";
        $this->url_get = "http://rating-metric-listener:8082/get/metrics";
        //$this->rt_web_put_ratings_sum = 0;
        //$this->rt_web_put_catalogue_sum = 0;
        //$this->rt_web_get_ratings_sum = 0;

    }

    /**
     * @Route(path="/rate/{sku}/{score}", methods={"PUT"})
     */
    public function put(Request $request, string $sku, int $score): Response
    {
        
        $score = min(max(1, $score), 5);
        $start = microtime();  
        
        try {
            if (false === $this->catalogueService->checkSKU($sku)) {
                throw new NotFoundHttpException("$sku not found");
            }
        } catch (\Exception $e) {
            throw new HttpException(500, $e->getMessage(), $e);
        }
        $rt_ratings_get_catalogue = microtime()-$start;
        try {
            $rating = $this->ratingsService->ratingBySku($sku);
            if (0 === $rating['avg_rating']) {
                // not rated yet
                $this->ratingsService->addRatingForSKU($sku, $score);
            } else {
                // iffy maths
                $newAvg = (($rating['avg_rating'] * $rating['rating_count']) + $score) / ($rating['rating_count'] + 1);
                $this->ratingsService->updateRatingForSKU($sku, $newAvg, $rating['rating_count'] + 1);
            }

            $rt_ratings_put_PDO = microtime()-$start-$rt_ratings_get_catalogue;
            $ch = curl_init($this->url_put);
            $data = array(
                "rt_ratings_get_catalogue" => strval($rt_ratings_get_catalogue),
                "rt_ratings_put_PDO" => strval($rt_ratings_put_PDO)
            );
            $payload = json_encode(array("metrics" => $data));
            curl_setopt( $ch, CURLOPT_POSTFIELDS, $payload );
            curl_setopt( $ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
            # Return response instead of printing.
            curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
            # Send request.
            $result = curl_exec($ch);
            curl_close($ch);
            # Print response.
            // echo "<pre>$result</pre>";
            //curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            return new JsonResponse([
                'success' => true,
            ]);
        } catch (\Exception $e) {
            throw new HttpException(500, 'Unable to update rating', $e);
        }
        
        
    }

    /**
     * @Route("/fetch/{sku}", methods={"GET"})
     */
    public function get(Request $request, string $sku): Response
    {
        $start = microtime();
        try {
            if (!$this->ratingsService->ratingBySku($sku)) {
                throw new NotFoundHttpException("$sku not found");
            }
        } catch (\Exception $e) {
            throw new HttpException(500, $e->getMessage(), $e);
        }
        $rt_web_get_ratings = microtime()-$start;
        $ch = curl_init($this->url_get);
        $data = array(
            'rt_web_get_ratings' => strval($rt_web_get_ratings),'dummy'=>"abc"
        );
        $payload = json_encode(array("metrics" => $data));
        curl_setopt( $ch, CURLOPT_POSTFIELDS, $payload );
        curl_setopt( $ch, CURLOPT_HTTPHEADER, array('Content-Type:application/json'));
        # Return response instead of printing.
        curl_setopt( $ch, CURLOPT_RETURNTRANSFER, true );
        # Send request.
        $result = curl_exec($ch);
        curl_close($ch);
        # Print response.
        // echo "<pre>$result</pre>";
        $rating = $this->ratingsService->ratingBySku($sku);
        return new JsonResponse($rating);
    }
}
