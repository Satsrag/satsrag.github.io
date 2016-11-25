<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="height=device-height, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0"/>
    <title>   </title>
    <style type="text/css">
        @font-face {
            font-family: MenksoftQagan_mirror;
            font-style: normal;
            font-weight: normal;
            src: url(http://static.zuga-tech.com/common/fonts/MenksoftQagan.ttf);
        }

        * {
            margin: 0px;
            padding: 0px;
        }

        #word {
            background-color: white;
            width: 100%;
        }

        #main {
            overflow-x: auto;
	-webkit-overflow-scrolling : touch;
        }

        .content {
            width: 90000px;
        }

        .trans_parent {
            float: left;
            font-family: MenksoftQagan_mirror;
            -ms-writing-mode: tb-lr;
            -moz-writing-mode: vertical-lr;
            -webkit-writing-mode: vertical-lr;
            -webkit-text-orientation: sideways-right;
            -o-writing-mode: vertical-lr;
            transform-origin: right top;
            writing-mode: vertical-lr;
            writing-mode: tb-lr;
            height: 100px;
            word-break: keep-all;
            letter-spacing: -0.015em;
            unicode-bidi: bidi-override;
            direction: ltr;

            border: 1px solid #a1a1a1;
            background: #f7f8fa;
            border-radius: 5px;
            margin: 20px;
            /* Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.115 Safari/537.36 */
        }

        .trans_parent .trans {
            color: black;
            border: 1px solid #a1a1a1;
            background: white;
            border-radius: 5px;
            margin: -1px;
        }

        .trans .desc {
            padding-top: 30px;
            color: red;
        }

        .trans_parent .icon img {
            height: 20px;
            width: 20px;
            margin: 10px;
        }

        p {
            padding: 10px;
            font-size: 20px;
        }

        img {
            margin-left: 20px;
            margin-right: 20px;
            height: 20px;
            width: 20px;
        }

        img.wordright {
            position: absolute;
            right: 0px;
            top: 0px;
            height: 50px;
            width: 50px;
            margin-top: 10px;
        }

        div .down {
            float: left;
        }

        div .status {
            float: right;
            padding-bottom: 10px;
        }

        p.down {
            padding-right: 10px;
            padding-left: 10px;
            padding-top: 0px;
            padding-bottom: 0px;
        }

    </style>

</head>

<body bgcolor="#f7f8fa" id="body">

<div id="word">
    <p>文字</p>
    <img class="wordright" src="./pics/4.png">
    <div>
        <img src="./pics/1.png">
        <img src="./pics/2.png">
        <img src="./pics/3.png">
    </div>
</div>


<div id="main">
    <div id="conten" class="content">
        <?php
        for ($x = 0; $x <= 50; $x++) {
            echo "
        <div id=\"trans_par";
            echo $x;
            echo "\" class=\"trans_parent\">
            <div class=\"trans\">
                <p></p>
                <p class=\"desc\">        Unicode   ᠃   
                      
                         ᠃       bootstrap  
                    ᠃</p>
            </div>
            
            <div class=\"icon\">
                <div class=\"down\">
                    <img class=\"down\" src=\"./pics/2.png\">
                    <p class=\"down\"></p>
                </div>
                <div class=\"status\">
                    <div class=\"down\">
                        <img class=\"down\" src=\"./pics/2.png\">
                        <p class=\"down\">10</p>
                    </div>
                    <div class=\"down\">
                        <img class=\"down\" src=\"./pics/2.png\">
                        <p class=\"down\">10</p>
                    </div>
                    <div class=\"down\">
                        <img class=\"down\" src=\"./pics/2.png\">
                        <p class=\"down\">10</p>
                    </div>
                </div>

            </div>
        </div>
        
    <script>
    var main = document . getElementById(\"main\");
    var wordHeight = document . getElementById(\"word\") . offsetHeight;
    var transParent = document . getElementById(\"trans_par";
            echo $x;
            echo "\");
    transParent . style . height = window . innerHeight - wordHeight - 40 + 'px';

   </script >
";
        } ?>


    </div>
</div>


<!--<script type="text/javascript">-->
<!--document.title = "关于我们-Bainu";-->
<!--var winHeight = window.innerHeight;-->
<!--var bodyWidth = (document.body.clientWidth > window.innerWidth) ? document.body.clientWidth : window.innerWidth;-->
<!--var viewport = document.querySelector("meta[name=viewport]");-->
<!--viewport.setAttribute('content', 'height=' + winHeight + ', width=' + bodyWidth);-->
<!--</script>-->
</body>
</html>
